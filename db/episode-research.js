// Episode research: asking a model a fixed CHECKLIST about every castaway, with WEB SEARCH, instead
// of parsing the wiki's tables.
//
// This is the second of two sources, deliberately kept separate from db/wiki-sync.js rather than
// folded into it (db/migrations/0014 explains the split). The tables are the better source for what
// they hold; this exists for everything they don't hold -- idol finds, sit-outs, advantages played,
// twists -- which is tier D in docs/RESEARCH-extractable-stats.md and which the table connector
// correctly reports nothing about. Those are the moments a fantasy league most wants to score.
//
// Four design choices carry the whole thing:
//
//   1. A CHECKLIST, NOT AN EXTRACTION. Every castaway gets an entry whether or not anything happened
//      to them. Coverage is then structural: a missing person is a missing array element, which
//      validation catches, instead of an absence nobody can see. That is the bug this repo has hit
//      twice -- a castaway who took votes and survived produced no "event", so she silently
//      disappeared from review.
//
//   2. THREE-VALUED ANSWERS. Every categorical answer is yes / no / unknown. "No" means the research
//      looked and it didn't happen; "unknown" means it couldn't be established. Collapsing those two
//      into false is what turns a gap in the sources into a confident wrong answer, and it is what a
//      reviewer most needs to be able to see.
//
//   3. SOURCES ON EVERY ANSWER. A web search is not reproducible -- run it tomorrow and it reads
//      different pages -- so unlike a wiki extraction there is no revision id to point at. Each
//      castaway's entry carries the URLs it was drawn from, and the run records every page the
//      search actually read. Nothing here is scored until a human confirms it; the sources are what
//      they check against, so they are load-bearing, not metadata.
//
//   4. THE SEARCH PROVIDER IS SWAPPABLE. Anthropic, Gemini and Grok all sell a model that can search
//      the live web, and which of them is best at finding a recap of last night's episode is an
//      empirical question nobody here has answered yet -- so it is a config value, not a code
//      decision. The checklist, the prompt, the validation and the cache are shared; only the ~40
//      lines that phrase the request differ per provider. Cross-checking two providers against the
//      same episode is then a flag, which is the cheapest quality measurement available.
//
// Cost, honestly: search results enter the context as input tokens, so this is dearer per episode
// than the table extraction (roughly $0.10-0.40 against ~$0.25 for a whole season of tables, at
// claude-opus-5 rates). It buys facts that are not otherwise obtainable, and it is per-episode, so a
// season in progress costs one episode's research a week rather than a re-read of everything.
//
//   node db/episode-research.js <leagueId> <episode> [--dry] [--force] [--provider=x] [--model=y]
//
// --dry prints the checklist and writes nothing, which is how to judge quality before trusting it.

require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Anthropic = require("@anthropic-ai/sdk");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");
const { z } = require("zod");
const { termsFor } = require("./wiki-sync.js");

// ---------- the checklist ----------
// Deliberately three-valued. `unknown` is not a failure state, it is the honest answer when the
// sources don't say, and it is the difference between "this didn't happen" and "we couldn't tell".
const Answer = z.enum(["yes", "no", "unknown"]);

// Exit methods, copied from state-logic.js's EXIT_METHODS, as a hard enum for the same reason
// wiki-sync.js does it: the value is written onto castaway.exitMethod, so anything outside this list
// is a silent data-shape break rather than a visible error.
const EXIT_METHODS = [
  "Voted Out",
  "Medically Evacuated",
  "Quit",
  "Lost Fire-Making",
  "Lost Final Tribal (Jury Vote)",
  "Sole Survivor",
  "Other",
];

const CastawayChecklist = z.object({
  name: z.string().describe("The castaway's full name, exactly as given in the list you were sent."),

  // --- leaving the game ---
  leftTheGame: Answer.describe("Did this person leave the game permanently in THIS episode?"),
  exitMethod: z
    .enum(EXIT_METHODS)
    .nullable()
    .describe("How they left, if they left. Null if they did not leave."),

  // --- tribal council ---
  attendedTribal: Answer.describe("Did they attend Tribal Council this episode?"),
  votesReceived: z
    .number()
    .int()
    .nullable()
    .describe("How many votes were cast against them at Tribal this episode. 0 if they attended and got none. Null if unknown or no Tribal."),
  votedFor: z
    .string()
    .nullable()
    .describe("The full name of the person they voted for, if reported. Null if unknown or they did not vote."),

  // --- challenges ---
  wonIndividualImmunity: Answer,
  wonTribeImmunity: Answer.describe("Were they on the tribe/team that won immunity?"),
  wonIndividualReward: Answer,
  wonTribeReward: Answer.describe("Were they on the tribe/team that won reward?"),
  satOutOfChallenge: Answer.describe("Did they sit out of a challenge this episode?"),

  // --- advantages ---
  foundAdvantage: Answer.describe("Did they FIND a hidden immunity idol or any advantage this episode?"),
  advantageFoundName: z
    .string()
    .nullable()
    .describe("What they found, in the show's own words ('hidden immunity idol', 'Beware Advantage', 'Shot in the Dark'). Null if nothing."),
  playedAdvantage: Answer.describe("Did they PLAY an idol or advantage this episode (their own or on someone else)?"),
  advantagePlayedName: z.string().nullable(),
  votesNullified: z
    .number()
    .int()
    .nullable()
    .describe("If an idol they played nullified votes, how many. Null otherwise."),
  advantageUsedAgainstThem: Answer.describe("Was an advantage used against them (a vote stolen, blocked, nullified)?"),

  // --- twists ---
  exiled: Answer.describe("Were they sent away from their tribe by an Exile Island-style twist while staying in the game?"),
  notableTwist: z
    .string()
    .nullable()
    .describe("Any other notable, checkable thing that happened to this person this episode, in one short phrase. Null if nothing."),

  // --- provenance, per person ---
  sources: z
    .array(z.string())
    .describe("URLs you actually read that support the answers above for THIS person. Empty only if every answer is 'unknown'."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("high: a source states it plainly. medium: a source implies it. low: pieced together or a single weak source."),
});

const EpisodeResearchSchema = z.object({
  episodeTitle: z.string().nullable(),
  airDate: z.string().nullable().describe("As printed on the source, e.g. 'March 5, 2026'."),
  summary: z.string().describe("Two or three sentences on what happened this episode, for a human reviewer to orient on."),
  tribalCouncilHeld: Answer,
  castaways: z
    .array(CastawayChecklist)
    .describe("EXACTLY ONE ENTRY PER CASTAWAY in the list you were sent, in that same order, including anyone nothing happened to."),
});

// ---------- the prompt ----------
// The instruction that matters most is the one about not answering from memory. The entire reason to
// pay for search is that the model's own recall of a season -- especially one currently airing -- is
// unverifiable and, for anything past its training cutoff, absent. An answer drawn from memory looks
// exactly like an answer drawn from a source, which is the failure this whole design is trying to
// avoid.
//
// Provider-neutral on purpose: it says "search" and never names a tool, because the three providers
// expose search as three different mechanisms (a server tool, a grounding flag, a search parameter)
// and none of them needs to be told what its own search is called.
function buildPrompt({ showName, season, episodeNumber, castNames, terms }) {
  const system = [
    `You research reality-TV episodes and answer a fixed checklist about every ${terms.castaway} in the cast.`,
    "",
    "RULES, in order of importance:",
    "1. SEARCH. Do not answer from memory. Every 'yes' and every number must come from a page you",
    "   actually read in this conversation. If your own recollection disagrees with what you find,",
    "   the sources win.",
    "2. 'unknown' IS A CORRECT ANSWER. Use 'no' when the sources cover this episode and the thing did",
    "   not happen. Use 'unknown' when you could not establish it either way. Never guess to fill the",
    "   checklist -- a wrong 'yes' costs more than an honest 'unknown', because a human has to review",
    "   every answer and a confident wrong one is the hardest to catch.",
    "3. EVERY PERSON GETS AN ENTRY, in the order given, including people nothing happened to. Do not",
    "   omit anyone, do not add anyone who is not on the list, and do not rename anyone.",
    "4. Cite the URLs you actually read, per person.",
    "",
    "Recaps disagree with each other and with fan wikis. Where they conflict, prefer the most",
    "specific and most recent source, lower the confidence, and say so in notableTwist.",
  ].join("\n");

  const user = [
    `${showName} season ${season}, episode ${episodeNumber}.`,
    "",
    `Research what happened in this episode and fill in the checklist for each of these ${castNames.length} ${terms.castaways}:`,
    "",
    ...castNames.map((n, i) => `${i + 1}. ${n}`),
    "",
    "Search for the episode recap, the episode's wiki page, and any reporting on idols or advantages",
    "found or played in it. Then answer the checklist for every person above.",
  ].join("\n");

  return { system, user };
}

// What the second pass is told when a provider can't search and answer in one call. It gets no
// search of its own, so it can only reorganise what the first pass found -- it cannot quietly
// introduce facts.
const STRUCTURE_SYSTEM =
  "Convert the research notes into the required structure. Use only what the notes contain; do not " +
  "add facts, do not fill gaps from your own knowledge, and answer 'unknown' where the notes are silent.";

// ---------- providers ----------
//
// A provider is four things:
//
//   id, defaultModel   -- what to call it and what to run if nobody said.
//   credentialError()  -- null when it can run, else the sentence telling the user which key to set.
//   combined(req)      -- search AND answer in the schema, in one call. Optional: a provider that
//                         can't do both at once throws CombinationUnsupported and the runner falls
//                         back. One call is strictly better when it works -- the model structures
//                         what it read rather than what it later wrote down about what it read.
//   search(req) + structure(req) -- the two-call fallback.
//
// Each returns the same three things, so everything above and below this section is provider-blind:
// `parsed` (schema-valid answers), `usage` ({input_tokens, output_tokens}), and `pagesRead` (the URLs
// the search actually fetched, taken off the response rather than from what the model claims).

class CombinationUnsupported extends Error {}

function providerFor(name) {
  const id = (name || process.env.RESEARCH_PROVIDER || "anthropic").toLowerCase();
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown research provider "${id}". Supported: ${Object.keys(PROVIDERS).join(", ")}.`);
  }
  return provider;
}

// One HTTP shape for the two REST providers. Deliberately not an SDK each: both are a single POST,
// and a dependency per provider would be three times the supply chain for the same request.
async function postJson(url, headers, body, label) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`${label}: could not reach the API (${e.message}).`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* left null on purpose -- the raw text is the better error below */
  }
  if (!res.ok) {
    const message = (json && ((json.error && (json.error.message || json.error)) || json.message)) || text.slice(0, 500);
    const err = new Error(`${label} HTTP ${res.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  if (!json) throw new Error(`${label}: the API returned something that isn't JSON.`);
  return json;
}

// A provider rejecting "search plus a response schema, together" is the one error worth retrying
// differently, and it arrives as a 400 whose wording differs per vendor -- so match on the shape of
// the complaint, not on an error code that doesn't exist.
function looksLikeCombinationRejection(err) {
  if (err && err.status !== 400) return false;
  return /response_?(mime_?type|schema|format)|output_config|structured|json.?mode|tool|function.?calling|grounding|google_?search|search_parameters/i.test(
    (err && err.message) || ""
  );
}

function parseJsonAnswer(text, schema, label) {
  if (!text || !text.trim()) throw new Error(`${label}: the model returned no text to parse.`);
  // Models that are told "JSON only" still occasionally wrap it in a fence. Cheap to undo, and the
  // alternative is throwing away an otherwise good answer.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let raw;
  try {
    raw = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`${label}: the model's answer wasn't valid JSON (${e.message}).`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(
      `${label}: the answer didn't match the checklist schema at ${(first.path || []).join(".") || "(root)"}: ${first.message}`
    );
  }
  return result.data;
}

// ---- JSON Schema, in the two dialects the REST providers accept ----
// Both are subsets of JSON Schema with their own holes, and zod's output is a superset of both, so
// each gets a sanitizer rather than a hand-written schema -- one checklist definition stays the
// single source of truth no matter who is asked.
function jsonSchemaFor(schema, dialect) {
  const json = z.toJSONSchema(schema, { io: "output" });
  return dialect === "gemini" ? geminiSchema(json) : strictSchema(json);
}

// Gemini takes an OpenAPI 3.0 subset: no additionalProperties, no numeric bounds, and null is a
// `nullable` flag rather than a member of a type union.
function geminiSchema(node) {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== "object") return node;

  const out = {};
  let nullable = false;
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "additionalProperties" || key === "minimum" || key === "maximum") continue;
    if (key === "exclusiveMinimum" || key === "exclusiveMaximum") continue;
    if (key === "type" && Array.isArray(value)) {
      const real = value.filter((t) => t !== "null");
      if (real.length !== value.length) nullable = true;
      out.type = real[0] || "string";
      continue;
    }
    if (key === "anyOf" && Array.isArray(value)) {
      const real = value.filter((v) => !(v && v.type === "null"));
      if (real.length !== value.length) nullable = true;
      // `x or null` is the only union the checklist uses, so collapsing it to the one real branch is
      // lossless here -- and it is the only form Gemini reliably accepts.
      if (real.length === 1) {
        Object.assign(out, geminiSchema(real[0]));
        continue;
      }
      out.anyOf = real.map(geminiSchema);
      continue;
    }
    out[key] = geminiSchema(value);
  }
  if (nullable) out.nullable = true;
  // Gemini does not guarantee key order from `properties` alone, and the checklist reads far better
  // to a human reviewer in the order it was declared.
  if (out.type === "object" && out.properties) out.propertyOrdering = Object.keys(out.properties);
  return out;
}

// OpenAI-compatible strict mode (what Grok implements): every property required and
// additionalProperties:false -- which zod already emits -- but no validation keywords beyond the
// structural ones.
function strictSchema(node) {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "minimum" || key === "maximum") continue;
    if (key === "exclusiveMinimum" || key === "exclusiveMaximum" || key === "format") continue;
    out[key] = strictSchema(value);
  }
  return out;
}

// ---- Anthropic ----
// The documented search tool for this model generation. Its dynamic filtering runs code execution
// internally, which is why code_execution must NOT also be declared -- two execution environments
// confuse the model.
const SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 12 };

const anthropicProvider = {
  id: "anthropic",
  defaultModel: "claude-opus-5",
  credentialError() {
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return null;
    return "Set ANTHROPIC_API_KEY in .env.local (or run `ant auth login`).";
  },
  async combined({ system, user, schema, model }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream({
          ...anthropicBase(model, system, user),
          tools: [SEARCH_TOOL],
          output_config: { format: zodOutputFormat(schema) },
        })
        .finalMessage();
      return {
        parsed: anthropicParsed(response),
        usage: anthropicUsage(response),
        pagesRead: anthropicPages(response),
        queries: anthropicQueries(response),
      };
    } catch (err) {
      const rejected =
        err instanceof Anthropic.BadRequestError && /output_config|format|tool/i.test(err.message || "");
      if (rejected) throw new CombinationUnsupported(err.message);
      throw anthropicError(err);
    }
  },
  async search({ system, user, model }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream({ ...anthropicBase(model, system, user), tools: [SEARCH_TOOL] })
        .finalMessage();
      return {
        text: response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
        usage: anthropicUsage(response),
        pagesRead: anthropicPages(response),
        queries: anthropicQueries(response),
      };
    } catch (err) {
      throw anthropicError(err);
    }
  },
  async structure({ notes, schema, model }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream({
          ...anthropicBase(model, STRUCTURE_SYSTEM, notes),
          output_config: { format: zodOutputFormat(schema) },
        })
        .finalMessage();
      return { parsed: anthropicParsed(response), usage: anthropicUsage(response) };
    } catch (err) {
      throw anthropicError(err);
    }
  },
};

function anthropicClient() {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
}

function anthropicBase(model, system, user) {
  return {
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }],
  };
}

function anthropicParsed(response) {
  if (response.stop_reason === "max_tokens") {
    throw new Error("The research hit its output limit and was cut off, so it is incomplete -- nothing saved.");
  }
  if (response.stop_reason === "refusal") {
    throw new Error(`The model declined this request (${response.stop_details && response.stop_details.category}).`);
  }
  if (!response.parsed_output) throw new Error("The model returned a response that did not match the checklist schema.");
  return response.parsed_output;
}

function anthropicUsage(response) {
  const u = response.usage || {};
  return { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 };
}

function anthropicPages(response) {
  const urls = [];
  for (const block of response.content || []) {
    if (block.type !== "web_search_tool_result") continue;
    // An errored search returns an OBJECT here, not a list -- branch before indexing.
    const results = Array.isArray(block.content) ? block.content : [];
    for (const r of results) if (r && r.url && !urls.includes(r.url)) urls.push(r.url);
  }
  return urls;
}

function anthropicQueries(response) {
  const queries = [];
  for (const block of response.content || []) {
    if (block.type === "server_tool_use" && block.name === "web_search" && block.input && block.input.query) {
      if (!queries.includes(block.input.query)) queries.push(block.input.query);
    }
  }
  return queries;
}

function anthropicError(err) {
  if (err instanceof CombinationUnsupported) return err;
  if (err instanceof Anthropic.AuthenticationError) return new Error("Anthropic rejected the credentials (check ANTHROPIC_API_KEY).");
  if (err instanceof Anthropic.RateLimitError) return new Error("Rate limited by the Anthropic API -- try again shortly.");
  if (err instanceof Anthropic.APIError) {
    const message = (err.error && err.error.error && err.error.error.message) || err.message || "unknown error";
    return new Error(`Anthropic API error ${err.status}: ${message}`);
  }
  return err;
}

// ---- Gemini ----
// Google Search grounding, over the REST API. Historically Gemini refused a response schema and a
// tool in the same request; if that is still true here the runner sees CombinationUnsupported and
// takes the two-call path, which costs a second call and loses nothing else.
const GEMINI_BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";

const geminiProvider = {
  id: "gemini",
  defaultModel: "gemini-2.5-pro",
  credentialError() {
    if (geminiKey()) return null;
    return "Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local.";
  },
  async combined({ system, user, schema, model }) {
    let json;
    try {
      json = await geminiCall(model, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: jsonSchemaFor(schema, "gemini"),
        },
      });
    } catch (err) {
      if (looksLikeCombinationRejection(err)) throw new CombinationUnsupported(err.message);
      throw err;
    }
    return {
      parsed: parseJsonAnswer(geminiText(json), schema, "Gemini"),
      usage: geminiUsage(json),
      pagesRead: geminiPages(json),
      queries: geminiQueries(json),
    };
  },
  async search({ system, user, model }) {
    const json = await geminiCall(model, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      tools: [{ google_search: {} }],
    });
    return {
      text: geminiText(json),
      usage: geminiUsage(json),
      pagesRead: geminiPages(json),
      queries: geminiQueries(json),
    };
  },
  async structure({ notes, schema, model }) {
    const json = await geminiCall(model, {
      systemInstruction: { parts: [{ text: STRUCTURE_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: notes }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: jsonSchemaFor(schema, "gemini"),
      },
    });
    return { parsed: parseJsonAnswer(geminiText(json), schema, "Gemini"), usage: geminiUsage(json) };
  },
};

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

function geminiCall(model, body) {
  // The key goes in a header, not the query string, so it can't end up in a log line or a proxy's
  // access log the way ?key= does.
  return postJson(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": geminiKey() }, body, "Gemini");
}

function geminiCandidate(json) {
  const candidate = (json.candidates || [])[0];
  if (!candidate) {
    const blocked = json.promptFeedback && json.promptFeedback.blockReason;
    throw new Error(blocked ? `Gemini blocked the request (${blocked}).` : "Gemini returned no candidates.");
  }
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`Gemini stopped early (${candidate.finishReason}), so the research is incomplete -- nothing saved.`);
  }
  return candidate;
}

function geminiText(json) {
  const parts = (geminiCandidate(json).content || {}).parts || [];
  // Thinking arrives as parts flagged `thought`. They are not the answer, and concatenating them
  // into it is how a perfectly good JSON response turns into a parse error.
  return parts.filter((p) => p && p.text && !p.thought).map((p) => p.text).join("");
}

function geminiPages(json) {
  const urls = [];
  const meta = geminiCandidate(json).groundingMetadata || {};
  for (const chunk of meta.groundingChunks || []) {
    const uri = chunk && chunk.web && chunk.web.uri;
    if (uri && !urls.includes(uri)) urls.push(uri);
  }
  return urls;
}

function geminiQueries(json) {
  const meta = geminiCandidate(json).groundingMetadata || {};
  return meta.webSearchQueries || [];
}

function geminiUsage(json) {
  const u = json.usageMetadata || {};
  return {
    input_tokens: u.promptTokenCount || 0,
    output_tokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
  };
}

// ---- Grok ----
// xAI's Live Search, over their OpenAI-compatible endpoint. `mode: "on"` rather than "auto" because
// the whole point of this call is that it searched -- letting the model decide it already knows is
// exactly the failure the prompt's first rule exists to prevent.
const XAI_BASE = process.env.XAI_API_BASE || "https://api.x.ai/v1";
const GROK_SEARCH = { mode: "on", return_citations: true, max_search_results: 12 };

const grokProvider = {
  id: "grok",
  defaultModel: "grok-4",
  credentialError() {
    if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) return null;
    return "Set XAI_API_KEY in .env.local.";
  },
  async combined({ system, user, schema, model }) {
    let json;
    try {
      json = await grokCall({
        model,
        messages: grokMessages(system, user),
        search_parameters: GROK_SEARCH,
        response_format: grokFormat(schema),
      });
    } catch (err) {
      if (looksLikeCombinationRejection(err)) throw new CombinationUnsupported(err.message);
      throw err;
    }
    return {
      parsed: parseJsonAnswer(grokText(json), schema, "Grok"),
      usage: grokUsage(json),
      pagesRead: grokPages(json),
      queries: [],
    };
  },
  async search({ system, user, model }) {
    const json = await grokCall({ model, messages: grokMessages(system, user), search_parameters: GROK_SEARCH });
    return { text: grokText(json), usage: grokUsage(json), pagesRead: grokPages(json), queries: [] };
  },
  async structure({ notes, schema, model }) {
    const json = await grokCall({
      model,
      messages: grokMessages(STRUCTURE_SYSTEM, notes),
      response_format: grokFormat(schema),
    });
    return { parsed: parseJsonAnswer(grokText(json), schema, "Grok"), usage: grokUsage(json) };
  },
};

function grokMessages(system, user) {
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function grokFormat(schema) {
  return {
    type: "json_schema",
    json_schema: { name: "episode_research", strict: true, schema: jsonSchemaFor(schema, "strict") },
  };
}

function grokCall(body) {
  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  return postJson(`${XAI_BASE}/chat/completions`, { authorization: `Bearer ${key}` }, body, "Grok");
}

function grokChoice(json) {
  const choice = (json.choices || [])[0];
  if (!choice) throw new Error("Grok returned no choices.");
  if (choice.finish_reason === "length") {
    throw new Error("The research hit its output limit and was cut off, so it is incomplete -- nothing saved.");
  }
  return choice;
}

function grokText(json) {
  return (grokChoice(json).message || {}).content || "";
}

function grokPages(json) {
  // Citations have moved between the response root and the message in this API's lifetime; read
  // both rather than silently record no sources for a run that had them.
  const found = json.citations || (grokChoice(json).message || {}).citations || [];
  const urls = [];
  for (const c of found) {
    const url = typeof c === "string" ? c : c && c.url;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function grokUsage(json) {
  const u = json.usage || {};
  return { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 };
}

const PROVIDERS = { anthropic: anthropicProvider, gemini: geminiProvider, grok: grokProvider };

// Checked before anything is read or asked, because "you have no key for this provider" is a
// two-second fix and finding it out after the DB work reads like the run got further than it did.
function requireCredentials(provider) {
  const problem = provider.credentialError();
  if (!problem) return;
  throw new Error(
    `No credentials for the "${provider.id}" research provider. ${problem}\n` +
      "This researcher uses a web-searching model, so it cannot run without one. " +
      `Pick a different provider with --provider=<${Object.keys(PROVIDERS).join("|")}> or RESEARCH_PROVIDER.`
  );
}

// ---------- the call ----------
// Search and a schema-valid answer in ONE request is what we want from every provider, because the
// model that read the pages is the one filling in the checklist. Where that combination is refused
// we search, then structure the notes -- a second call, and a small loss of fidelity, but never a
// failed run.
async function runResearch({ system, user, schema, provider, model }) {
  requireCredentials(provider);

  if (provider.combined) {
    try {
      const out = await provider.combined({ system, user, schema, model });
      return { ...out, passes: 1 };
    } catch (err) {
      if (!(err instanceof CombinationUnsupported)) throw err;
      console.log(`[research] ${provider.id} won't search and answer in a schema at once -- falling back to two calls`);
    }
  }

  const searched = await provider.search({ system, user, model });
  if (!searched.text.trim()) throw new Error(`${provider.id} searched but wrote nothing to structure.`);
  const structured = await provider.structure({ notes: searched.text, schema, model });
  return {
    parsed: structured.parsed,
    usage: sumUsage(searched.usage, structured.usage),
    pagesRead: searched.pagesRead,
    queries: searched.queries || [],
    passes: 2,
  };
}

function sumUsage(a, b) {
  return {
    input_tokens: (a.input_tokens || 0) + (b.input_tokens || 0),
    output_tokens: (a.output_tokens || 0) + (b.output_tokens || 0),
  };
}

// ---------- validation ----------
// The schema guarantees shape; this guards content, same division of labour as wiki-sync.js. The
// checks that matter are about COVERAGE and about answers contradicting themselves -- a checklist
// whose whole promise is "everyone is accounted for" has to be held to it.
function validateResearch(parsed, castNames, terms) {
  const problems = [];
  const fatal = [];
  const byName = new Map();

  for (const entry of parsed.castaways || []) {
    const name = String((entry && entry.name) || "").trim();
    if (!name) { fatal.push(`an entry had no name`); continue; }
    if (byName.has(name.toLowerCase())) { problems.push(`${name} answered twice (kept the first)`); continue; }
    byName.set(name.toLowerCase(), entry);
  }

  // Coverage, in both directions.
  const missing = castNames.filter((n) => !byName.has(n.toLowerCase()));
  const extra = [...byName.values()]
    .map((e) => e.name)
    .filter((n) => !castNames.some((c) => c.toLowerCase() === n.trim().toLowerCase()));
  if (missing.length) fatal.push(`no answers for ${missing.length} ${terms.castaways}: ${missing.join(", ")}`);
  if (extra.length) problems.push(`answers for ${extra.length} ${terms.castaways} who aren't in the cast, dropped: ${extra.join(", ")}`);

  // Self-contradictions. Each is cheap to check and each would otherwise reach a reviewer as a
  // plausible-looking pair of answers.
  for (const entry of byName.values()) {
    if (entry.leftTheGame === "yes" && !entry.exitMethod) {
      problems.push(`${entry.name}: left the game but no exit method given`);
    }
    if (entry.leftTheGame !== "yes" && entry.exitMethod) {
      problems.push(`${entry.name}: an exit method on someone who didn't leave (ignored)`);
      entry.exitMethod = null;
    }
    if (entry.attendedTribal === "no" && Number.isInteger(entry.votesReceived) && entry.votesReceived > 0) {
      problems.push(`${entry.name}: ${entry.votesReceived} votes against someone who didn't attend Tribal`);
    }
    if (entry.wonIndividualImmunity === "yes" && entry.leftTheGame === "yes" && entry.exitMethod === "Voted Out") {
      problems.push(`${entry.name}: voted out despite winning individual immunity`);
    }
    if (entry.foundAdvantage === "yes" && !entry.advantageFoundName) {
      problems.push(`${entry.name}: found an advantage but didn't say what`);
    }
    // The rule the whole design rests on: a positive claim with nothing behind it.
    const claims = ["leftTheGame", "wonIndividualImmunity", "wonIndividualReward", "foundAdvantage", "playedAdvantage", "satOutOfChallenge"]
      .filter((k) => entry[k] === "yes");
    if (claims.length && (!entry.sources || !entry.sources.length)) {
      problems.push(`${entry.name}: claims ${claims.join(", ")} with no source cited`);
    }
  }

  const answered = [...byName.values()];
  const counts = {
    castaways: answered.length,
    unknowns: answered.reduce((n, e) => n + Object.values(e).filter((v) => v === "unknown").length, 0),
    lowConfidence: answered.filter((e) => e.confidence === "low").length,
    sourced: answered.filter((e) => e.sources && e.sources.length).length,
  };
  return { entries: answered, problems, fatal, counts };
}

// ---------- who to ask about ----------
// The cast comes from the SEASON (db/migrations/0011) when an admin has staged one, and from the
// league's own roster otherwise -- the same two places every other part of this app looks. Research
// is keyed on the season, not the league, so a league is only ever the route to "which show, which
// season, which people".
async function resolveResearchContext(pool, leagueId, episodeNumber) {
  const { rows } = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new Error(`No league with id ${leagueId}`);
  const league = rows[0];
  const settings = (league.state && league.state.settings) || {};
  const showSlug = settings.showId;
  const season = settings.wikiSeason;
  if (!showSlug || !season) {
    throw new Error(
      `League "${league.name}" has no show and season set. Set them in League Settings first -- ` +
        "this won't guess which season you mean."
    );
  }

  const { rows: catalog } = await pool.query(
    `SELECT s.id AS show_id, s.name AS show_name, s.castaway_term, s.tribe_term,
            ss.id AS season_id, ss.name AS season_name
       FROM shows s LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number = $2
      WHERE s.slug = $1`,
    [showSlug, season]
  );
  if (!catalog.length) {
    throw new Error(
      `League "${league.name}" points at show "${showSlug}", which isn't in the catalog. ` +
        "Re-add it in Admin > Shows & Seasons, or pick a different show in League Settings."
    );
  }
  const entry = catalog[0];
  const { terms } = termsFor(entry);

  let castNames = [];
  let castFrom = "season";
  if (entry.season_id) {
    const { rows: cast } = await pool.query(
      "SELECT name FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC",
      [entry.season_id]
    );
    castNames = cast.map((c) => c.name);
  }
  if (!castNames.length) {
    castFrom = "league";
    castNames = ((league.state && league.state.castaways) || []).map((c) => c.name).filter(Boolean);
  }
  if (!castNames.length) {
    throw new Error(
      `No cast to ask about for ${entry.show_name} season ${season}. Pull and approve the season's ` +
        "cast in Admin > Shows & Seasons first, or enter the cast in the league."
    );
  }

  // Everyone gets asked about, including people already voted out. Cheaper than it looks -- the
  // checklist is one line per person and the search is shared -- and it is the only way the answer
  // can say "this person was already gone", which is itself a check on the research being real.
  return {
    league,
    showId: entry.show_id,
    showSlug,
    showName: entry.show_name,
    season: Number(season),
    seasonId: entry.season_id || null,
    episodeNumber,
    castNames,
    castFrom,
    terms,
  };
}

// ---------- the cache (db/migrations/0014) ----------
// Keyed on (show, season, episode) and NOT on anything about the sources, unlike wiki_extractions:
// there is no revision id for "the internet as it was last Thursday", so the only honest cache rule
// is "we already researched this episode once; ask again only if you say so".
async function cachedResearch(pool, showId, season, episodeNumber, opts) {
  if (opts.force) return null;
  const { rows } = await pool.query(
    `SELECT id, payload, provenance, researched_at FROM episode_research
      WHERE show_id=$1 AND season_number=$2 AND episode_number=$3`,
    [showId, season, episodeNumber]
  );
  if (!rows.length) return null;
  console.log(
    `[research] episode ${episodeNumber} was researched ${new Date(rows[0].researched_at).toISOString()} ` +
      "-- reusing it (no model call). Pass --force to research it again."
  );
  return { ...rows[0], cached: true };
}

async function storeResearch(pool, ctx, payload, provenance, opts) {
  if (opts.dry) {
    console.log("[research] --dry: nothing written");
    return { id: null, payload, provenance, cached: false };
  }
  const { rows } = await pool.query(
    `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
     ON CONFLICT (show_id, season_number, episode_number)
     DO UPDATE SET payload=EXCLUDED.payload, provenance=EXCLUDED.provenance, researched_at=now()
     RETURNING id`,
    [ctx.showId, ctx.season, ctx.episodeNumber, JSON.stringify(payload), JSON.stringify(provenance)]
  );
  return { id: rows[0].id, payload, provenance, cached: false };
}

// ---------- the run ----------
async function researchEpisode(pool, leagueId, episodeNumber, opts = {}) {
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    throw new Error(`Episode number must be a positive whole number, got "${episodeNumber}".`);
  }
  const provider = providerFor(opts.provider);
  const model = opts.model || process.env.RESEARCH_MODEL || provider.defaultModel;
  const ctx = await resolveResearchContext(pool, leagueId, episodeNumber);

  const cached = await cachedResearch(pool, ctx.showId, ctx.season, episodeNumber, opts);
  if (cached) {
    const review = validateResearch(cached.payload, ctx.castNames, ctx.terms);
    return { ...ctx, ...review, payload: cached.payload, provenance: cached.provenance, cached: true };
  }

  // After the cache, deliberately: re-reading research somebody already paid for shouldn't need a key.
  requireCredentials(provider);
  console.log(
    `[research] ${ctx.showName} season ${ctx.season} episode ${episodeNumber}: ` +
      `${ctx.castNames.length} ${ctx.terms.castaways} (from the ${ctx.castFrom}), via ${provider.id}/${model}`
  );
  const { system, user } = buildPrompt(ctx);
  const out = await runResearch({ system, user, schema: EpisodeResearchSchema, provider, model });
  console.log(
    `[research] tokens: ${out.usage.input_tokens} in / ${out.usage.output_tokens} out` +
      ` (${out.passes} call${out.passes === 1 ? "" : "s"}), ${out.pagesRead.length} page(s) read`
  );

  const review = validateResearch(out.parsed, ctx.castNames, ctx.terms);
  for (const problem of review.problems) console.log(`[research] ! ${problem}`);
  if (review.fatal.length) {
    throw new Error(
      `The research isn't usable, so nothing was saved:\n  ${review.fatal.join("\n  ")}\n` +
        "Re-run it (--force) or try another provider; a partial checklist is worse than none, because " +
        "a reviewer can't see who is missing from it."
    );
  }

  // Everything needed to judge the answer later: who was asked, who answered, and every page the
  // search actually fetched. This is the substitute for a revision id -- see migration 0014.
  const provenance = {
    provider: provider.id,
    model,
    passes: out.passes,
    researchedAt: new Date().toISOString(),
    showSlug: ctx.showSlug,
    seasonNumber: ctx.season,
    episodeNumber,
    castFrom: ctx.castFrom,
    castAsked: ctx.castNames,
    queries: out.queries || [],
    pagesRead: out.pagesRead,
    usage: out.usage,
    problems: review.problems,
  };
  const stored = await storeResearch(pool, ctx, out.parsed, provenance, opts);
  return { ...ctx, ...review, payload: out.parsed, provenance, cached: false, id: stored.id };
}

// What a human actually reads before deciding whether to trust any of this. Only the lines with
// something on them -- a checklist where most answers are "no" is mostly noise on a terminal.
function printResearch(result) {
  const { payload, counts, terms } = result;
  console.log(`\n${payload.episodeTitle || "(untitled episode)"}${payload.airDate ? ` -- ${payload.airDate}` : ""}`);
  console.log(payload.summary);
  console.log(`Tribal Council held: ${payload.tribalCouncilHeld}\n`);

  for (const e of result.entries) {
    const notes = [];
    if (e.leftTheGame === "yes") notes.push(`OUT (${e.exitMethod || "method unknown"})`);
    if (Number.isInteger(e.votesReceived) && e.votesReceived > 0) notes.push(`${e.votesReceived} vote(s)`);
    if (e.votedFor) notes.push(`voted ${e.votedFor}`);
    if (e.wonIndividualImmunity === "yes") notes.push("individual immunity");
    if (e.wonTribeImmunity === "yes") notes.push("tribe immunity");
    if (e.wonIndividualReward === "yes") notes.push("individual reward");
    if (e.wonTribeReward === "yes") notes.push("tribe reward");
    if (e.satOutOfChallenge === "yes") notes.push("sat out");
    if (e.foundAdvantage === "yes") notes.push(`found ${e.advantageFoundName || "an advantage"}`);
    if (e.playedAdvantage === "yes") notes.push(`played ${e.advantagePlayedName || "an advantage"}`);
    if (Number.isInteger(e.votesNullified) && e.votesNullified > 0) notes.push(`${e.votesNullified} vote(s) nullified`);
    if (e.advantageUsedAgainstThem === "yes") notes.push("advantage used against them");
    if (e.exiled === "yes") notes.push("exiled");
    if (e.notableTwist) notes.push(e.notableTwist);
    if (!notes.length) continue;
    console.log(`  ${e.name} [${e.confidence}] -- ${notes.join("; ")}`);
  }

  const quiet = result.entries.length - result.entries.filter((e) => e.sources && e.sources.length).length;
  console.log(
    `\n${counts.castaways} ${terms.castaways}, ${counts.unknowns} unknown answer(s), ` +
      `${counts.lowConfidence} low-confidence, ${quiet} with no source cited.`
  );
  console.log(`pages read: ${(result.provenance.pagesRead || []).join("\n            ") || "(none recorded)"}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const [leagueId, episode] = args.filter((a) => !a.startsWith("--"));
  const valueOf = (name) => {
    const hit = flags.find((f) => f.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const opts = {
    dry: flags.includes("--dry"),
    force: flags.includes("--force"),
    provider: valueOf("provider"),
    model: valueOf("model"),
  };

  if (!leagueId || !episode) {
    console.error(
      "usage: node db/episode-research.js <leagueId> <episode> [--dry] [--force]\n" +
        `                                  [--provider=${Object.keys(PROVIDERS).join("|")}] [--model=...]\n` +
        "\n" +
        "Asks a web-searching model a fixed checklist about every castaway in the season's cast.\n" +
        "--dry researches and prints without writing, which is how to judge a provider before trusting it."
    );
    process.exitCode = 1;
  } else {
    const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
    researchEpisode(pool, leagueId, Number(episode), opts)
      .then(printResearch)
      .catch((e) => {
        console.error("[research] " + e.message);
        process.exitCode = 1;
      })
      .finally(() => pool.end());
  }
}

module.exports = {
  EpisodeResearchSchema,
  CastawayChecklist,
  buildPrompt,
  validateResearch,
  researchEpisode,
  printResearch,
  resolveResearchContext,
  runResearch,
  providerFor,
  jsonSchemaFor,
  geminiSchema,
  strictSchema,
  parseJsonAnswer,
  looksLikeCombinationRejection,
  CombinationUnsupported,
  PROVIDERS,
  EXIT_METHODS,
  SEARCH_TOOL,
  STRUCTURE_SYSTEM,
};
