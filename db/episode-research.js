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
const decisions = require("./season-decisions.js");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");
const { z } = require("zod");
const { termsFor } = require("./wiki-sync.js");
const StateLogic = require("../src/lib/game/state-logic.js");
// The show's game rules (docs/PLAN-show-formats.md): what the checklist asks, which contradictions to
// flag, and which answers become which results are the format's. The run, the providers, the
// coverage rules and the cache are the same for every format.
const Formats = require("../src/lib/game/formats/index.js");
const embeddings = require("./embeddings.js");

// ---------- the checklist ----------
// Deliberately three-valued. `unknown` is not a failure state, it is the honest answer when the
// sources don't say, and it is the difference between "this didn't happen" and "we couldn't tell".
const Answer = z.enum(["yes", "no", "unknown"]);

// The whole answer for one episode: a few episode-level fields, then one checklist entry per person.
// The checklist itself is the format's (format.research.checklistSchema); its exit methods are a hard
// enum for the same reason wiki-sync.js's are -- the value is written onto castaway.exitMethod.
function researchSchemaFor(format) {
  return z.object({
    episodeTitle: z.string().nullable(),
    airDate: z.string().nullable().describe("As printed on the source, e.g. 'March 5, 2026'."),
    summary: z.string().describe("Two or three sentences on what happened this episode, for a human reviewer to orient on."),
    ...format.research.episodeFields(z, Answer),
    castaways: z
      .array(format.research.checklistSchema(z, Answer))
      .describe("EXACTLY ONE ENTRY PER CASTAWAY in the list you were sent, in that same order, including anyone nothing happened to."),
  });
}

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
function buildPrompt({ showName, season, episodeNumber, castNames, terms, domains = [], format }) {
  const system = [
    `You research reality-TV episodes and answer a fixed checklist about every ${terms.castaway} still in the game.`,
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
    ...format.research.searchHint,
    // Anthropic enforces this list (allowed_domains on its search tool); for the others it's advice.
    ...(domains.length ? ["", `Use these sites: ${domains.join(", ")}.`] : []),
    "Two or three good pages are enough -- don't keep searching once the episode is covered.",
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

// Some sites block Anthropic's crawler, and a search restricted to one of them is refused outright
// ("The following domains are not accessible to our user agent: ['ew.com']"). Not worth failing a
// run over: runResearch drops the named sites and asks again.
class DomainsBlocked extends Error {
  constructor(domains, message) {
    super(message);
    this.domains = domains;
  }
}
function blockedDomainsIn(err) {
  const m = /domains are not accessible[^[]*\[([^\]]*)\]/i.exec((err && err.message) || "");
  if (!m) return null;
  const list = m[1].split(",").map((d) => d.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  return list.length ? list : null;
}

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
// The models an admin may pick for research (Admin > Shows & Seasons). Cheapest first.
const RESEARCH_MODELS = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"];

// Five searches, not twelve: with the search restricted to trusted sites (below), a handful of
// queries finds the recap and the wiki page, and every search both costs a fee and pours its results
// into the context as input tokens -- the biggest share of a research call's cost.
const MAX_SEARCHES = 5;

// The search tool depends on the model generation: web_search_20260209 (dynamic filtering) is for
// Opus/Sonnet 4.6 and later; Haiku 4.5 only has the basic variant. The dynamic variant runs code
// execution internally, which is why code_execution must NOT also be declared.
function searchToolFor(model, domains) {
  const type = model === "claude-haiku-4-5" ? "web_search_20250305" : "web_search_20260209";
  const tool = { type, name: "web_search", max_uses: MAX_SEARCHES };
  // Trusted sites only (shows.research_domains). Fewer, better pages -- and cheaper ones.
  if (domains && domains.length) tool.allowed_domains = domains;
  return tool;
}
const SEARCH_TOOL = searchToolFor("claude-opus-5", null); // kept for callers that inspect the default

// Haiku 4.5 predates adaptive thinking and the effort setting; sending either is a 400. The others
// run at medium effort -- effort is the main lever on thinking (output) tokens, and a checklist
// against fetched pages doesn't need the default "high".
function anthropicModelParams(model) {
  if (model === "claude-haiku-4-5") return { thinking: null, effort: null };
  return { thinking: { type: "adaptive" }, effort: "medium" };
}

const anthropicProvider = {
  id: "anthropic",
  defaultModel: "claude-opus-5",
  credentialError() {
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return null;
    return "Set ANTHROPIC_API_KEY in .env.local (or run `ant auth login`).";
  },
  async combined({ system, user, schema, model, domains }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream({
          ...anthropicBase(model, system, user, zodOutputFormat(schema)),
          tools: [searchToolFor(model, domains)],
        })
        .finalMessage();
      return {
        parsed: anthropicParsed(response),
        usage: anthropicUsage(response),
        pagesRead: anthropicPages(response),
        queries: anthropicQueries(response),
      };
    } catch (err) {
      const blocked = blockedDomainsIn(err);
      if (blocked) throw new DomainsBlocked(blocked, err.message);
      const rejected =
        err instanceof Anthropic.BadRequestError && /output_config|format|tool/i.test(err.message || "");
      if (rejected) throw new CombinationUnsupported(err.message);
      throw anthropicError(err);
    }
  },
  async search({ system, user, model, domains }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream({ ...anthropicBase(model, system, user, null), tools: [searchToolFor(model, domains)] })
        .finalMessage();
      return {
        text: response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
        usage: anthropicUsage(response),
        pagesRead: anthropicPages(response),
        queries: anthropicQueries(response),
      };
    } catch (err) {
      const blocked = blockedDomainsIn(err);
      if (blocked) throw new DomainsBlocked(blocked, err.message);
      throw anthropicError(err);
    }
  },
  async structure({ notes, schema, model }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream(anthropicBase(model, STRUCTURE_SYSTEM, notes, zodOutputFormat(schema)))
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

function anthropicBase(model, system, user, format) {
  const { thinking, effort } = anthropicModelParams(model);
  const output_config = { ...(format ? { format } : {}), ...(effort ? { effort } : {}) };
  return {
    model,
    max_tokens: 32000,
    ...(thinking ? { thinking } : {}),
    // Caches the stable prefix (tools + instructions). Small saving on a one-off; it's what a
    // "Research again" minutes later benefits from.
    cache_control: { type: "ephemeral" },
    system,
    messages: [{ role: "user", content: user }],
    ...(Object.keys(output_config).length ? { output_config } : {}),
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
  return {
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    // Billed separately from tokens ($10 per 1,000) -- carried so the admin panel can show a real cost.
    web_search_requests: (u.server_tool_use && u.server_tool_use.web_search_requests) || 0,
    cache_read_input_tokens: u.cache_read_input_tokens || 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
  };
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
  // An alias, not a pinned id, unlike the Anthropic model above. Google retires pinned ids out from
  // under existing code -- `gemini-2.5-flash` already answers 404 with "no longer available to new
  // users" on a fresh key -- so a pin here is a time bomb, and --model / RESEARCH_MODEL is how to
  // pin one deliberately when a run has to be reproducible.
  defaultModel: "gemini-pro-latest",
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

async function geminiCall(model, body) {
  try {
    // The key goes in a header, not the query string, so it can't end up in a log line or a proxy's
    // access log the way ?key= does.
    return await postJson(
      `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": geminiKey() },
      body,
      "Gemini"
    );
  } catch (err) {
    throw geminiHint(err, body);
  }
}

// Two failures that are certain to be hit and that Google's own message doesn't explain. Measured,
// not guessed: on a free-tier key, plain generation and structured output both return 200 while
// anything carrying google_search returns 429 with "limit: 0" -- grounding simply has no free quota,
// which reads like rate limiting and isn't.
function geminiHint(err, body) {
  const searched = !!(body && body.tools);
  // The hint goes FIRST and the vendor's own text after it. Google's quota error is a wall that
  // repeats itself four times, so an explanation appended to the end is an explanation nobody reads
  // -- which was exactly how it looked in the admin UI before this.
  const lead = (hint) => new Error(`${hint}\n\nGoogle said: ${dedupeLines(err.message)}`);
  if (err.status === 429 && searched) {
    return lead(
      "Google Search grounding has NO free-tier quota: a key on a project without billing is refused " +
        "every grounded request, while ungrounded ones succeed -- so this reads like rate limiting " +
        "and isn't. Enable billing on this key's Google Cloud project, or switch the research " +
        "provider to anthropic or grok."
    );
  }
  if (err.status === 503) return lead("That is Google's capacity, not this request. Retry, or pick another model.");
  if (err.status === 404 && /no longer available/i.test(err.message)) {
    return lead('Google has retired that model id. Pick a current one, or leave the model unset to use the "latest" alias.');
  }
  return err;
}

// Google repeats the same quota line once per metric and once per model, so the same sentence can
// appear four times in one message. Identical lines add nothing to a reader.
function dedupeLines(message) {
  const seen = new Set();
  return String(message)
    .split(/\s*\*\s+|\n/)
    .map((line) => line.trim())
    .filter((line) => line && !seen.has(line) && seen.add(line) !== undefined)
    .join(" · ");
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
      `The other providers are: ${Object.keys(PROVIDERS).filter((p) => p !== provider.id).join(", ")} ` +
      "(set RESEARCH_PROVIDER, or pass --provider= on the CLI)."
  );
}

// ---------- the call ----------
// Search and a schema-valid answer in ONE request is what we want from every provider, because the
// model that read the pages is the one filling in the checklist. Where that combination is refused
// we search, then structure the notes -- a second call, and a small loss of fidelity, but never a
// failed run.
async function runResearch(req) {
  let domains = req.domains || [];
  const blocked = [];
  // Twice is enough: the refusal lists every blocked site at once.
  for (let attempt = 0; ; attempt++) {
    try {
      const out = await researchOnce({ ...req, domains });
      return { ...out, domains, blockedDomains: blocked };
    } catch (err) {
      if (!(err instanceof DomainsBlocked) || attempt >= 2) throw err;
      blocked.push(...err.domains);
      domains = domains.filter((d) => !err.domains.includes(d));
      console.log(`[research] ${err.domains.join(", ")} block the search crawler -- retrying without them`);
      if (!domains.length) throw new Error(`Every research site blocks Anthropic's search (${blocked.join(", ")}). Edit the show's research sites in Settings.`);
    }
  }
}

async function researchOnce({ system, user, schema, provider, model, domains }) {
  requireCredentials(provider);

  if (provider.combined) {
    try {
      const out = await provider.combined({ system, user, schema, model, domains });
      return { ...out, passes: 1 };
    } catch (err) {
      if (!(err instanceof CombinationUnsupported)) throw err;
      console.log(`[research] ${provider.id} won't search and answer in a schema at once -- falling back to two calls`);
    }
  }

  const searched = await provider.search({ system, user, model, domains });
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
  const out = {};
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) out[k] = ((a || {})[k] || 0) + ((b || {})[k] || 0);
  return out;
}

// ---------- validation ----------
// The schema guarantees shape; this guards content, same division of labour as wiki-sync.js. The
// checks that matter are about COVERAGE and about answers contradicting themselves -- a checklist
// whose whole promise is "everyone is accounted for" has to be held to it.
function validateResearch(parsed, castNames, terms, format) {
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
    problems.push(...format.research.entryProblems(entry));
    // The rule the whole design rests on: a positive claim with nothing behind it.
    const claims = format.research.claims.filter((k) => entry[k] === "yes");
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
// Research is SEASON data -- keyed on (show, season, episode), reviewed once, true for every league
// playing it -- exactly like the cast is (db/migrations/0011). So the season is the real unit, and
// there are two ways in:
//
//   by season  -- what Admin > Shows & Seasons calls. The staged cast is the cast, full stop.
//   by league  -- what the CLI takes, because a league id is what a developer has to hand. It reads
//                 the show and season off league state and then falls back to the league's own
//                 roster if the season has no staged cast, which is the one thing the admin path
//                 can't do (there is no league to fall back to).

async function catalogEntry(pool, showSlug, season, label) {
  const { rows } = await pool.query(
    `SELECT s.id AS show_id, s.name AS show_name, s.castaway_term, s.tribe_term,
            s.research_domains, s.wiki_api_url, s.format,
            ss.id AS season_id, ss.name AS season_name
       FROM shows s LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number = $2
      WHERE s.slug = $1`,
    [showSlug, season]
  );
  if (!rows.length) {
    throw new Error(
      `${label} points at show "${showSlug}", which isn't in the catalog. ` +
        "Re-add it in Admin > Shows & Seasons, or pick a different show in League Settings."
    );
  }
  return rows[0];
}

async function stagedCastNames(pool, seasonId) {
  if (!seasonId) return [];
  const { rows } = await pool.query(
    "SELECT name FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC",
    [seasonId]
  );
  return rows.map((c) => c.name);
}

// The sites research may search: the show's own list (shows.research_domains, editable in its
// Settings), or by default its wiki plus a few general TV recap sites.
function domainsFor(entry) {
  if (entry.research_domains && entry.research_domains.length) return entry.research_domains;
  let wikiHost = null;
  try {
    wikiHost = entry.wiki_api_url ? new URL(entry.wiki_api_url).hostname.replace(/^www\./, "") : null;
  } catch {
    /* a malformed URL just means no wiki domain in the default list */
  }
  // Not ew.com: it blocks Anthropic's crawler.
  return [wikiHost, "tvline.com", "parade.com"].filter(Boolean);
}

// Only ask about people still in the game at this episode. Asking about the whole cast every week
// spends output tokens (the checklist is one entry per person) on people who can't have done
// anything. Who's gone is taken from what this season already knows -- eliminations in the cached
// wiki extraction, and "left the game" in earlier episodes' research -- matched by name the same
// forgiving way everything else here matches names.
async function stillInGame(pool, showId, season, episodeNumber, castNames) {
  const gone = new Set();
  const { rows: ext } = await pool.query(
    "SELECT payload FROM wiki_extractions WHERE show_id=$1 AND season_number=$2 AND kind='episodes'",
    [showId, season]
  );
  for (const ep of (ext[0] && ext[0].payload && ext[0].payload.episodes) || []) {
    if (ep.number < episodeNumber) for (const el of ep.eliminations || []) gone.add(el.name);
  }
  const { rows: prior } = await pool.query(
    "SELECT payload FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number < $3",
    [showId, season, episodeNumber]
  );
  for (const r of prior) for (const c of (r.payload && r.payload.castaways) || []) if (c.leftTheGame === "yes") gone.add(c.name);

  const roster = { castaways: castNames.map((name, i) => ({ id: String(i), name })) };
  const goneIdx = new Set();
  for (const name of gone) {
    const { castaway } = StateLogic.Core.findCastawayByName(roster, name);
    if (castaway) goneIdx.add(castaway.id);
  }
  return {
    active: castNames.filter((_, i) => !goneIdx.has(String(i))),
    skipped: castNames.filter((_, i) => goneIdx.has(String(i))),
  };
}

function contextFrom(entry, showSlug, season, episodeNumber, castNames, castFrom, skippedCast = []) {
  return {
    domains: domainsFor(entry),
    skippedCast,
    showId: entry.show_id,
    showSlug,
    showName: entry.show_name,
    season: Number(season),
    seasonId: entry.season_id || null,
    seasonName: entry.season_name || null,
    episodeNumber,
    castNames,
    castFrom,
    terms: termsFor(entry).terms,
    format: Formats.formatFor(entry.format),
  };
}

async function resolveSeasonResearchContext(pool, showSlug, season, episodeNumber) {
  const entry = await catalogEntry(pool, showSlug, season, `Season ${showSlug} ${season}`);
  const castNames = await stagedCastNames(pool, entry.season_id);
  if (!castNames.length) {
    // No league fallback here on purpose: the admin path has no league to borrow a roster from, and
    // researching a season whose cast nobody has staged would ask about nobody.
    throw new Error(
      `No cast to ask about for ${entry.show_name} season ${season}. Pull the season's cast first -- ` +
        "the checklist is one question per person, so it needs the list of people."
    );
  }
  const { active, skipped } = await stillInGame(pool, entry.show_id, season, episodeNumber, castNames);
  return contextFrom(entry, showSlug, season, episodeNumber, active, "season", skipped);
}

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

  const entry = await catalogEntry(pool, showSlug, season, `League "${league.name}"`);
  let castFrom = "season";
  let castNames = await stagedCastNames(pool, entry.season_id);
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
  const { active, skipped } = await stillInGame(pool, entry.show_id, season, episodeNumber, castNames);
  return { league, ...contextFrom(entry, showSlug, season, episodeNumber, active, castFrom, skipped) };
}

// ---------- the cache (db/migrations/0014) ----------
// Keyed on (show, season, episode) and NOT on anything about the sources, unlike wiki_extractions:
// there is no revision id for "the internet as it was last Thursday", so the only honest cache rule
// is "we already researched this episode once; ask again only if you say so".
async function cachedResearch(pool, showId, season, episodeNumber, formatId, opts) {
  if (opts.force) return null;
  const { rows } = await pool.query(
    `SELECT id, payload, provenance, researched_at FROM episode_research
      WHERE show_id=$1 AND season_number=$2 AND episode_number=$3`,
    [showId, season, episodeNumber]
  );
  if (!rows.length) return null;
  // Answers to another format's checklist (the show was switched since) don't answer this one.
  // Research from before formats recorded none, and was all asked under the default.
  if (((rows[0].provenance && rows[0].provenance.format) || Formats.DEFAULT_FORMAT) !== formatId) return null;
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

// ---------- staging: turning answered checklists into season decisions ----------
//
// Research stages into the same season_decisions table as the wiki connector (db/migrations/0019),
// for an admin to decide once for every league. A fact both sources report lands on one row, marked
// as coming from both.

// One "yes" answer -> one item CANDIDATE. Only 'yes' ever produces one: 'no' is a fact worth
// recording but not a scoring event, and 'unknown' must never silently become one -- collapsing that
// distinction is exactly the failure the three-valued schema exists to prevent (see the top of this
// file). Which answers imply which results is the format's (format.research.items).
function itemsFromChecklist(entry, format) {
  const items = [];
  // `method` is only for a role (the role value); an event's identity is its eventType.
  const add = (kind, eventType, method = "") =>
    items.push({ castawayName: entry.name, kind, eventType, method, confidence: entry.confidence, sources: entry.sources || [] });
  format.research.items(entry, add);
  return items;
}

// All the candidates for one episode's research, deduplicated by (name, kind, eventType) -- the same
// identity the unique index enforces, which is also what collapses two answers that imply the same
// result (Survivor's individual and tribe reward both mean rewardWin). Computed once because the
// answers are identical for every league on the season; only the reveal gate below varies per league.
function candidatesFor(payload, format) {
  const byKey = new Map();
  for (const entry of payload.castaways || []) {
    for (const item of itemsFromChecklist(entry, format)) {
      const key = `${item.castawayName.toLowerCase()}|${item.kind}|${item.eventType}`;
      if (!byKey.has(key)) byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

/**
 * Stages one research run's "yes" answers as pending season decisions. Names are the season cast's
 * own (research is asked about exactly those names), mapped through the same forgiving match anyway
 * in case the model reworded one. Post-merge isn't something research asks about, so it's borrowed
 * from whatever the wiki already staged for that episode.
 */
async function stageResearchDecisions(pool, run, opts = {}) {
  const seasonId = run.seasonId || (await decisions.seasonIdFor(pool, run.showId, run.season));
  if (!seasonId) throw new Error(`${run.showSlug} season ${run.season} isn't in the catalog.`);
  const castState = await decisions.seasonCastState(pool, seasonId);
  const { rows: merge } = await pool.query(
    "SELECT bool_or(post_merge) AS post_merge FROM season_decisions WHERE season_id=$1 AND episode_number=$2 AND from_wiki",
    [seasonId, run.episodeNumber]
  );
  const postMerge = !!(merge[0] && merge[0].post_merge);
  const items = candidatesFor(run.payload, run.format).map((c) => ({
    episode: run.episodeNumber,
    postMerge,
    kind: c.kind,
    name: decisions.canonicalName(castState, c.castawayName),
    method: c.method || "",
    eventType: c.eventType,
    confidence: c.confidence,
    sources: c.sources,
  }));
  if (opts.dry || !run.id) return { inserted: 0, updated: 0, withdrawn: 0, total: items.length, dry: true };
  const r = await decisions.stageDecisions(pool, seasonId, items, "research", run.id, { episode: run.episodeNumber });
  return { ...r, total: items.length };
}

/** Re-stages every episode already researched for a season, from the stored answers -- no search,
 * no model call. The research counterpart of wiki-sync's stageCachedSeasonEpisodes. */
async function stageCachedSeasonResearch(pool, seasonId) {
  const { rows } = await pool.query(
    `SELECT er.id, er.episode_number, er.payload, er.provenance, s.id AS show_id, s.slug, s.format, ss.season_number
       FROM show_seasons ss
       JOIN shows s ON s.id = ss.show_id
       JOIN episode_research er ON er.show_id = s.id AND er.season_number = ss.season_number
      WHERE ss.id = $1
      ORDER BY er.episode_number`,
    [seasonId]
  );
  let inserted = 0;
  for (const r of rows) {
    const out = await stageResearchDecisions(pool, {
      id: r.id,
      seasonId,
      showId: r.show_id,
      showSlug: r.slug,
      season: r.season_number,
      episodeNumber: r.episode_number,
      payload: r.payload,
      // The format the answers were asked under, which is what their shape follows.
      format: Formats.formatFor((r.provenance && r.provenance.format) || r.format),
    });
    inserted += out.inserted;
  }
  return { episodes: rows.length, inserted };
}

// ---------- the run ----------
/** Admin > Shows & Seasons: research one episode of one catalogued season, and stage the answered
 * checklist as season decisions for the admin to review alongside the wiki's -- the same table and
 * the same review, so nothing reaches a league until an admin accepts it. */
async function researchSeasonEpisode(pool, showSlug, season, episodeNumber, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const result = await runFor(pool, await resolveSeasonResearchContext(pool, showSlug, season, episodeNumber), opts);
  return { ...result, decisions: await stageResearchDecisions(pool, result, opts) };
}

/** The CLI's way in: a league id, which is what a developer has to hand -- it names the season. The
 * answers are staged for the whole season, like the admin path. */
async function researchEpisode(pool, leagueId, episodeNumber, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const result = await runFor(pool, await resolveResearchContext(pool, leagueId, episodeNumber), opts);
  return { ...result, decisions: await stageResearchDecisions(pool, result, opts) };
}

function requireEpisodeNumber(episodeNumber) {
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    throw new Error(`Episode number must be a positive whole number, got "${episodeNumber}".`);
  }
}

async function runFor(pool, ctx, opts) {
  const episodeNumber = ctx.episodeNumber;
  const provider = providerFor(opts.provider);
  const model = opts.model || process.env.RESEARCH_MODEL || provider.defaultModel;

  const cached = await cachedResearch(pool, ctx.showId, ctx.season, episodeNumber, ctx.format.id, opts);
  if (cached) {
    const review = validateResearch(cached.payload, ctx.castNames, ctx.terms, ctx.format);
    // `id` matters even on a cache hit: staging needs a research_id to file decisions against, and
    // re-staging a cached episode must not require paying for the search again.
    return { ...ctx, ...review, payload: cached.payload, provenance: cached.provenance, cached: true, id: cached.id };
  }

  // After the cache, deliberately: re-reading research somebody already paid for shouldn't need a key.
  requireCredentials(provider);
  console.log(
    `[research] ${ctx.showName} season ${ctx.season} episode ${episodeNumber}: ` +
      `${ctx.castNames.length} ${ctx.terms.castaways} (from the ${ctx.castFrom}), via ${provider.id}/${model}`
  );
  const { system, user } = buildPrompt(ctx);
  const out = await runResearch({ system, user, schema: researchSchemaFor(ctx.format), provider, model, domains: ctx.domains });
  console.log(
    `[research] tokens: ${out.usage.input_tokens} in / ${out.usage.output_tokens} out` +
      ` (${out.passes} call${out.passes === 1 ? "" : "s"}), ${out.pagesRead.length} page(s) read`
  );

  const review = validateResearch(out.parsed, ctx.castNames, ctx.terms, ctx.format);
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
    // Whose checklist this answers -- see cachedResearch.
    format: ctx.format.id,
    castFrom: ctx.castFrom,
    castAsked: ctx.castNames,
    // Already out before this episode, so not asked about (see stillInGame).
    castSkipped: ctx.skippedCast || [],
    domains: out.domains,
    // Sites that refused the crawler this run -- worth removing from the show's list in Settings.
    domainsBlocked: out.blockedDomains,
    queries: out.queries || [],
    pagesRead: out.pagesRead,
    usage: out.usage,
    problems: review.problems,
  };
  const stored = await storeResearch(pool, ctx, out.parsed, provenance, opts);

  // Semantic search (db/embeddings.js) over the same answer, best-effort. Deliberately not fatal to
  // this run: the checklist itself is already stored and is the valuable part, and an embedding
  // hiccup (no GEMINI_API_KEY configured, a transient error) shouldn't undo a successful research
  // run over a feature that only backs side-bet suggestions. --dry skips it, same as storeResearch
  // itself -- there is nothing durable yet to search against.
  if (!opts.dry && stored.id) {
    try {
      const { stored: chunkCount } = await embeddings.storeChunksForEpisode(pool, ctx, out.parsed);
      console.log(`[research] embedded ${chunkCount} chunk(s) for semantic search`);
    } catch (e) {
      console.log(`[research] ! could not embed for semantic search (side-bet suggestions won't see this episode): ${e.message}`);
    }
  }

  return { ...ctx, ...review, payload: out.parsed, provenance, cached: false, id: stored.id };
}

// What a human actually reads before deciding whether to trust any of this. Only the lines with
// something on them -- a checklist where most answers are "no" is mostly noise on a terminal.
function printResearch(result) {
  const { payload, counts, terms, format } = result;
  console.log(`\n${payload.episodeTitle || "(untitled episode)"}${payload.airDate ? ` -- ${payload.airDate}` : ""}`);
  console.log(payload.summary);
  // The format's episode-level questions (Survivor: tribalCouncilHeld).
  for (const key of Object.keys(format.research.episodeFields(z, Answer))) console.log(`${key}: ${payload[key]}`);
  console.log("");

  for (const e of result.entries) {
    const notes = format.research.notes(e);
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
        "Asks a web-searching model a fixed checklist about every castaway still in the game.\n" +
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
  researchSchemaFor,
  buildPrompt,
  validateResearch,
  researchEpisode,
  researchSeasonEpisode,
  printResearch,
  resolveResearchContext,
  resolveSeasonResearchContext,
  itemsFromChecklist,
  candidatesFor,
  stageResearchDecisions,
  stageCachedSeasonResearch,
  runResearch,
  providerFor,
  jsonSchemaFor,
  geminiSchema,
  strictSchema,
  parseJsonAnswer,
  looksLikeCombinationRejection,
  dedupeLines,
  CombinationUnsupported,
  PROVIDERS,
  SEARCH_TOOL,
  RESEARCH_MODELS,
  MAX_SEARCHES,
  STRUCTURE_SYSTEM,
};
