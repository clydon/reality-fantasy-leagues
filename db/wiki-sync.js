// Wiki connector: fetches a season's data from survivor.fandom.com, has Claude extract it into a
// strict schema, validates it against the season's cast, and stages it for an ADMIN to review once
// for the whole season (the cast in season_cast, 0011; episode results in season_decisions, 0019).
// Nothing reaches a league until an admin accepts it -- see src/lib/server/season-decisions.ts.
//
// Plain CommonJS, same shape as db/migrate.js and db/seed-dev-admin.js, with TWO callers:
//
//   1. the CLI below (`node db/wiki-sync.js ...`), which is what the nightly schedule runs. The Next
//      app has no persistent server process, so recurring runs are scheduled externally --
//      .github/workflows/wiki-sync.yml, or Windows Task Scheduler locally.
//   2. `runForSeason`, imported by the admin route POST /api/admin/seasons/:id/sync, which is what
//      the per-season Pull buttons in Admin > Shows & Seasons call. Nothing in here may import
//      anything Next-specific, for the same reason push-core.js may not: the CLI has to keep
//      running under bare `node`.
//
//   node db/wiki-sync.js all                       # every season any league tracks, read once each
//   node db/wiki-sync.js cast <leagueId>           # import the cast list for the league's season
//   node db/wiki-sync.js episodes <leagueId>       # import per-episode eliminations + scoring events
//   node db/wiki-sync.js <command> [id] --dry      # extract and print, write nothing
//   node db/wiki-sync.js <command> [id] --force    # re-read even if the wiki hasn't changed
//
// `all` is what the schedule runs (.github/workflows/wiki-sync.yml). It groups leagues by the season
// they track, so a season is fetched and extracted ONCE however many leagues are playing it -- see
// the extraction-cache note below.
//
// The league's show and season come from settings.showId/settings.wikiSeason; this refuses to run
// rather than guess either.
//
// Everything here is SEASON-scoped: fetch the wiki, ask the model what it says, cache it in
// `wiki_extractions` keyed by (show, season), and stage the result for admin review. Cache hits are
// decided by wiki REVISION ID, not by age: an unchanged season costs nothing to re-run, a changed one
// is re-read immediately.
//
// `episodes` produces one reviewable DECISION per result (season_decisions), not one big payload:
// each elimination, scoring event and exile is accepted, rejected or corrected on its own, in
// Admin > Shows & Seasons. The two halves it reads differ a lot in trustworthiness -- eliminations and exit
// methods come off a well-structured column, while immunity/reward wins and zero-vote-safes are
// inference over a rowspan-heavy grid and footnote markers -- and that difference now rides on each
// item's own `confidence` rather than splitting the run into two all-or-nothing proposals. One model
// call either way, because it needs both tables in front of it: eliminations come from the vote
// table, immunity from the episode guide.
//
// `cast` still files a whole-list proposal (wiki_proposals, kind='cast') -- a season's cast arrives
// once, with no per-episode axis to review it along.
//
// ---------------------------------------------------------------------------------------------
// WHAT THE INVESTIGATION FOUND, and why this is shaped the way it is (full notes in the plan doc):
//
// * Season pages do NOT contain the tables inline. "Survivor 44" holds `{{S44votetable}}` and
//   `{{S44epguide}}`; the real tables live on Template:S44votetable / Template:S44epguide. The cast
//   list, however, IS inline on the season page under ==Castaways==, which is why cast import needs
//   only one page fetch.
// * The cast table is the most reliably structured thing on the wiki: one row per castaway with
//   name, original tribe, finish, votes-against, and a photo filename.
// * Extraction here is LLM-based by explicit choice. That means it is NOT reproducible from the
//   inputs alone, so every proposal records provenance (page titles + wiki revision ids + model +
//   timestamp) and every extracted field is re-validated below before it can become a proposal.
// ---------------------------------------------------------------------------------------------

require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Anthropic = require("@anthropic-ai/sdk");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");
const { z } = require("zod");
// The game-logic engine, required here so extraction-time validation resolves wiki names with the
// EXACT same rule that apply-time uses (Core.findCastawayByName). Two copies of that matching logic
// would be two chances for a proposal to validate and then fail to apply.
const StateLogic = require("../src/lib/game/state-logic.js");
// The show's game rules (docs/PLAN-show-formats.md): the per-episode schema, prompt, section names and
// event checks are the format's, not this file's. The cast read is the same for every format.
const Formats = require("../src/lib/game/formats/index.js");
// Same sender the Next routes use -- plain CommonJS for exactly this reason (see its header).
const decisions = require("./season-decisions.js");

const WIKI_API = "https://survivor.fandom.com/api.php";
// Per the claude-api skill's default. Extraction input here is one table (~1-2K tokens) and output
// is ~1K, so a run costs on the order of a cent -- model choice is not the cost lever at this size.
const MODEL = process.env.WIKI_MODEL || "claude-opus-5";

// The models an admin may pick for wiki extraction (Admin > Shows & Seasons). Cheapest first.
// Haiku 4.5 predates adaptive thinking and the effort setting -- sending either is a 400 -- so the
// request is shaped per model rather than assuming every Claude model takes the same parameters.
const WIKI_MODELS = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"];
function modelParams(model) {
  if (model === "claude-haiku-4-5") return {};
  // Medium, not the default high: table reading is structured work against a strict schema plus a
  // validation pass, and effort is the main lever on output (thinking) tokens.
  return { thinking: { type: "adaptive" }, output_config_extra: { effort: "medium" } };
}

// ---------- the schema Claude must produce ----------
// Enforced by the API via structured outputs, so a response that doesn't fit this shape doesn't come
// back at all. Shape-valid is not the same as correct, though, which is what validateCast is for.
const CastSchema = z.object({
  tribes: z
    .array(z.object({ name: z.string() }))
    .describe(
      "The distinct starting groups the cast is divided into, in the order the table presents them. " +
        "What these are called varies by show (tribes, factions, teams, houses); use whatever the " +
        "table's own grouping column gives. Empty if the show has no such grouping."
    ),
  castaways: z.array(
    z.object({
      name: z.string().describe("Full name as the wiki gives it, e.g. 'Bruce Perreault'."),
      tribeName: z
        .string()
        .nullable()
        .describe(
          "This person's ORIGINAL group (the first grouping column: original tribe, starting " +
            "faction, starting team), or null if the table doesn't give one."
        ),
      photoFile: z
        .string()
        .nullable()
        .describe("The File: name from the row, e.g. 'S44 bruce t.png', without the 'File:' prefix. Null if absent."),
    })
  ),
});

// The per-episode schema is the show format's (format.wiki.episodesSchema) -- its exit methods and
// event types are hard enums, because applyEliminationsImport writes the method straight onto
// castaway.exitMethod, and a value outside the list would be a silent data-shape break rather than a
// visible error.

// ---------- MediaWiki ----------
// apiUrl defaults to Survivor's wiki so the exported helper stays usable standalone, but callers
// pass the show's own endpoint from the catalog -- different shows, different wikis.
async function fetchWikitext(title, apiUrl = WIKI_API) {
  const url =
    `${apiUrl}?action=query&prop=revisions&titles=${encodeURIComponent(title)}` +
    `&rvprop=content|ids&rvslots=main&format=json&formatversion=2`;
  // A descriptive UA is the polite thing on a community wiki, and Fandom is friendlier to it.
  const res = await fetch(url, { headers: { "user-agent": "reality-fantasy-leagues/wiki-sync" } });
  if (!res.ok) throw new Error(`Wiki fetch failed for "${title}": HTTP ${res.status}`);
  const data = await res.json();
  const page = data && data.query && data.query.pages && data.query.pages[0];
  if (!page || page.missing) throw new Error(`Wiki page not found: "${title}"`);
  const rev = page.revisions && page.revisions[0];
  return {
    title: page.title,
    revisionId: rev ? rev.revid : null,
    wikitext: rev && rev.slots && rev.slots.main ? rev.slots.main.content : "",
  };
}

// Resolves File: names to real CDN URLs in ONE batched call. Deterministic -- no model involved, so
// no chance of an invented image URL. Best-effort: anything that doesn't resolve simply gets no
// photo, which the app already handles (CastawayAvatar falls back to initials).
// Fandom's imageinfo hands back the REVISION form of a file URL:
//
//   https://static.wikia.nocookie.net/survivor/images/5/57/S51_aaliyah_t.png/revision/latest?cb=20260904163427
//
// which doesn't load from another site -- an <img> pointing at it fails, and every imported castaway
// shows initials instead of a photo. The canonical path above it, the same URL up to the extension,
// always loads. So the suffix is cut here, at the one place wiki file URLs enter this app, rather
// than left for each consumer to deal with.
//
// The same rule is applied again in src/lib/game/selectors.ts's castawayPhotoSrc, for a URL somebody
// pastes into League Settings' Photo URL field by hand -- copying an image address off a Fandom page
// gives you exactly this form. Two small copies rather than a shared module, because state-logic and
// its selectors deliberately have no dependency on anything under db/.
function normalizePhotoUrl(url) {
  const raw = String(url == null ? "" : url).trim();
  if (!raw) return null;
  const cut = raw.indexOf("/revision/");
  return cut === -1 ? raw : raw.slice(0, cut);
}

async function resolvePhotoUrls(fileNames, apiUrl = WIKI_API) {
  const wanted = fileNames.filter(Boolean).slice(0, 50); // API caps titles per request
  if (!wanted.length) return {};
  const titles = wanted.map((f) => "File:" + f).join("|");
  const url =
    `${apiUrl}?action=query&titles=${encodeURIComponent(titles)}` +
    `&prop=imageinfo&iiprop=url&format=json&formatversion=2`;
  try {
    const res = await fetch(url, { headers: { "user-agent": "reality-fantasy-leagues/wiki-sync" } });
    if (!res.ok) return {};
    const data = await res.json();
    const out = {};
    for (const page of (data.query && data.query.pages) || []) {
      if (page.missing || !page.imageinfo || !page.imageinfo[0]) continue;
      out[page.title.replace(/^File:/, "")] = normalizePhotoUrl(page.imageinfo[0].url);
    }
    return out;
  } catch {
    return {}; // photos are a nice-to-have; never fail a cast import over them
  }
}

// ---------- finding the cast section ----------
// Wikitext headings: ==Title==, at any level from 2 to 6. Matched with a regex rather than indexOf()
// because the original did an exact `indexOf("==Castaways==")` and therefore missed
// "== Contestants ==" -- a different word AND different spacing -- on the Traitors wiki.
const HEADING_RE = /^(={2,6})[ \t]*([^=\n]+?)[ \t]*\1[ \t]*$/gm;

function listHeadings(wikitext) {
  const out = [];
  HEADING_RE.lastIndex = 0;
  let m;
  while ((m = HEADING_RE.exec(wikitext))) {
    out.push({ level: m[1].length, title: m[2].trim(), start: m.index });
  }
  return out;
}

// Just enough English to get a singular and a plural out of whatever term an admin typed --
// including a term typed already-plural ("Contestants"), which a naive pluralizer turns into
// "Contestantses". Mirrors plural()/singular() in src/lib/use-show-terms.ts; duplicated rather than
// shared because this is a standalone CommonJS CLI with no access to the Next/TS build.
const LOOKS_PLURAL = /[^sciux]s$/i;

function plural(word) {
  if (!word) return word;
  if (LOOKS_PLURAL.test(word)) return word;
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + 'es';
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

function singular(word) {
  if (!word) return word;
  if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
  if (LOOKS_PLURAL.test(word)) return word.slice(0, -1);
  return word;
}

// The show's own vocabulary, in every form the prompts and messages need. Normalized to singular
// first so a term entered either way ("Castaway" or "Castaways") yields the same set. Its own
// function so callers holding only a catalog row can get the terms WITHOUT resolving a season
// context, which would fetch the wiki.
function termsFor(entry) {
  const castawayTerm = singular(((entry && entry.castaway_term) || "Castaway").trim());
  const tribeTerm = singular(((entry && entry.tribe_term) || "Tribe").trim());
  return {
    castawayTerm,
    tribeTerm,
    terms: {
      Castaway: castawayTerm,
      Castaways: plural(castawayTerm),
      castaway: castawayTerm.toLowerCase(),
      castaways: plural(castawayTerm).toLowerCase(),
      Tribe: tribeTerm,
      Tribes: plural(tribeTerm),
      tribe: tribeTerm.toLowerCase(),
      tribes: plural(tribeTerm).toLowerCase(),
    },
  };
}

// What a season page might call its cast section, best guess first:
//   1. the show's explicit override, when an admin set one (shows.cast_section_heading)
//   2. the show's own castaway_term, pluralized then singular -- which is how Survivor's
//      "Castaways", Traitors' "Contestants" and Big Brother's "Houseguests" all fall out of a term
//      the admin has already entered, with no extra configuration
//   3. the words wikis reach for regardless of show
// Deduplicated case-insensitively so an override that matches a guess doesn't get tried twice.
function castSectionCandidates(castawayTerm, override) {
  const term = singular((castawayTerm || 'Castaway').trim());
  const seen = new Set();
  return [override, plural(term), term, 'Castaways', 'Contestants', 'Cast', 'Cast Members', 'Houseguests', 'Players', 'Competitors']
    .map((c) => (c || '').trim())
    .filter((c) => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
}

// Slices the page down to one section before the model sees it. Deterministic, which is the whole
// point: asking the model to "find the cast section" is how a row goes missing.
//
// Runs to the next heading of the SAME OR SHALLOWER level, so a section with subsections keeps them.
// The old version cut at the next `==` of any kind, which would have truncated a cast table split
// into "===Tribe A===" / "===Tribe B===" subsections.
function findSection(wikitext, candidates) {
  const headings = listHeadings(wikitext);
  for (const want of candidates) {
    const i = headings.findIndex((h) => h.title.toLowerCase() === want.toLowerCase());
    if (i < 0) continue;
    const h = headings[i];
    const next = headings.slice(i + 1).find((n) => n.level <= h.level);
    return { matched: want, title: h.title, text: wikitext.slice(h.start, next ? next.start : wikitext.length) };
  }
  return null;
}

// ---------- transclusion ----------
// A section can be nothing but template calls. The Traitors season page's Contestants section is
// literally `{{US5 Contestant History}}` + `{{US5 Contestant Info}}` -- the cast table itself lives
// on Template:US5 Contestant Info. That's the same shape the investigation found for Survivor's vote
// and episode tables ({{S44votetable}}), so this is built generically rather than for one show.
//
// One level deep, and only templates whose wikitext actually contains a table (`{|`). That filter is
// what keeps inline formatting templates out of the prompt -- {{c|faithful|...}}, {{s|...}} resolve
// to coloured spans, carry no rows, and would cost tokens for nothing.
const MAX_SECTION_CHARS = 60000;

function transcludedNames(wikitext) {
  const names = [];
  // The name runs from `{{` to the first `|` or `}`. Parser functions and interwiki calls contain
  // `:` or `#` and are excluded by the character class rather than filtered afterwards.
  const re = /\{\{\s*([^|{}\n#:]+?)\s*(?=[|}])/g;
  let m;
  while ((m = re.exec(wikitext))) {
    const name = m[1].trim();
    // `{{!}}` and magic words like {{PAGENAME}} aren't pages worth fetching.
    if (!name || name === '!' || /^[A-Z0-9_]+$/.test(name)) continue;
    if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  return names;
}

// Returns the section text with any table-bearing templates appended, plus the pages that were read,
// so provenance names every page the extraction actually saw and not just the season page.
async function expandTranscludedTables(sectionText, apiUrl) {
  const names = transcludedNames(sectionText).slice(0, 20);
  if (!names.length) return { text: sectionText, pages: [] };

  const titles = names.map((n) => (/^template:/i.test(n) ? n : 'Template:' + n));
  const url =
    `${apiUrl}?action=query&prop=revisions&titles=${encodeURIComponent(titles.join('|'))}` +
    `&rvprop=content|ids&rvslots=main&format=json&formatversion=2`;
  let data;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'reality-fantasy-leagues/wiki-sync' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    // Not fatal by itself: a season page whose cast IS inline needs none of this, and one whose cast
    // is transcluded fails validation immediately after with a clear "too few" message.
    console.log(`[wiki-sync] could not expand transcluded templates (${e.message}) -- using the section as-is`);
    return { text: sectionText, pages: [] };
  }

  let text = sectionText;
  const pages = [];
  for (const page of (data.query && data.query.pages) || []) {
    if (page.missing) continue;
    const rev = page.revisions && page.revisions[0];
    const content = (rev && rev.slots && rev.slots.main && rev.slots.main.content) || '';
    if (!content.includes('{|')) continue; // no table -> nothing to extract from
    if (text.length + content.length > MAX_SECTION_CHARS) {
      console.log(`[wiki-sync] skipping "${page.title}" -- would exceed the ${MAX_SECTION_CHARS}-char extraction cap`);
      continue;
    }
    // Labelled, so the model can tell one transcluded table from another and from the section body.
    text += `\n\n<!-- transcluded from ${page.title} -->\n${content}`;
    pages.push({ title: page.title, revisionId: rev ? rev.revid : null, apiUrl });
  }
  if (pages.length) {
    console.log(`[wiki-sync] expanded ${pages.length} transcluded table(s): ${pages.map((p) => p.title).join(', ')}`);
  }
  return { text, pages };
}

// ---------- extraction ----------
// `terms` carries the show's own vocabulary from the catalog (shows.castaway_term/tribe_term), so
// the prompt asks about Contestants and Factions for a Traitors season rather than Castaways and
// Tribes. The wikitext is the authority either way -- this only stops the prompt from describing a
// table using a word that appears nowhere in it.
// One place that talks to the API, so both extractors share the credential handling and -- more to
// the point -- the typed error translation, which is the part worth not duplicating.
async function callModel({ system, user, schema, schemaName, maxTokens, model = MODEL }) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error(
      "No Anthropic credentials found. Set ANTHROPIC_API_KEY in .env.local (or run `ant auth login`) for a " +
        "local run, in the workflow's repository secrets for the nightly job, or in the deployment's " +
        "environment variables for the admin Pull buttons.\n" +
        "This connector uses LLM extraction, so it cannot run without one."
    );
  }
  // An org-scoped API key (sk-ant-api...) has to say which workspace to bill/run in; a
  // workspace-scoped key carries that already and needs no header. Set ANTHROPIC_WORKSPACE_ID in
  // .env.local for the former, or leave it unset for the latter.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic(
    workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}
  );
  try {
    // STREAMED, not a plain create/parse. The SDK refuses a non-streaming request whose max_tokens
    // implies it could run past its 10-minute limit -- which the episodes extraction does, since its
    // output scales with episodes x people. Streaming also removes the request-timeout risk on the
    // long runs generally, and `finalMessage()` still carries `parsed_output` for a parseable
    // output_config, so structured outputs work exactly as before.
    const { thinking, output_config_extra } = modelParams(model);
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens || 16000,
      ...(thinking ? { thinking } : {}),
      // Caches the stable prefix (instructions + schema). Saves little on a one-off pull; it's the
      // re-pull of the same season minutes later that it pays for.
      cache_control: { type: "ephemeral" },
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema), ...(output_config_extra || {}) },
    });
    const response = await stream.finalMessage();
    // Truncation shows up as a stop_reason, not as a parse failure, and a half-extracted season would
    // otherwise look like a season that simply had fewer episodes.
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        `The extraction hit the ${maxTokens || 16000}-token output limit and was cut off, so it is incomplete -- nothing filed.`
      );
    }
    // parsed_output is null when the response couldn't be parsed into the schema.
    if (!response.parsed_output) {
      throw new Error(`Claude returned a response that did not match the ${schemaName} schema.`);
    }
    return { parsed: response.parsed_output, usage: { ...response.usage, model } };
  } catch (err) {
    // Typed, most-specific-first, so a transient rate limit reads differently from a bad key.
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Anthropic rejected the credentials (check ANTHROPIC_API_KEY).");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Rate limited by the Anthropic API -- try again shortly.");
    // This one is worth naming explicitly: the raw 400 is long and the fix isn't obvious from it.
    if (err instanceof Anthropic.BadRequestError && /anthropic-workspace-id/i.test(err.message || "")) {
      throw new Error(
        [
          "That API key isn't scoped to a workspace, so the request needs a workspace id.",
          "Either set ANTHROPIC_WORKSPACE_ID=wrkspc_... in .env.local (Console > Settings > Workspaces),",
          "or create a workspace-scoped API key, which needs no extra config.",
        ].join("\n")
      );
    }
    if (err instanceof Anthropic.APIError) {
      // Prefer the API's own human-readable message over err.message, which prefixes the status and
      // then embeds the whole raw JSON body -- unhelpful for the cases an operator actually hits
      // (no credit balance, bad model id, oversized request).
      const apiMessage =
        (err.error && err.error.error && err.error.error.message) || err.message || "unknown error";
      throw new Error(`Anthropic API error ${err.status}: ${apiMessage}`);
    }
    throw err;
  }
}

// `terms` carries the show's own vocabulary from the catalog (shows.castaway_term/tribe_term), so
// the prompt asks about Contestants and Factions for a Traitors season rather than Castaways and
// Tribes. The wikitext is the authority either way; this only stops the prompt from describing a
// table using a word that appears nowhere in it.
async function extractCast(sectionWikitext, terms, model, format) {
  const { parsed, usage } = await callModel({
    model: model || MODEL,
    schema: CastSchema,
    schemaName: "cast",
    system:
      "You extract structured data from MediaWiki wikitext. Report only what the wikitext actually " +
      "states. Never infer, complete or correct a name from outside knowledge of the show -- if a " +
      `field isn't in the text, return null for it. Use each ${terms.castaway}'s ORIGINAL ` +
      `${terms.tribe} (the first ${terms.tribe} column), not a later shuffled or merged one. ` +
      "Some of the text may be tables pulled in from transcluded templates, each marked with an " +
      "HTML comment naming where it came from; treat those as part of the same section. If the " +
      "same person appears in more than one of those tables, return them ONCE." +
      // A format's own warning about its cast table (The Traitors: Faction is a secret role, not a
      // group -- read as one, it would publish every Traitor as a tribe).
      (format && format.wiki.castNote ? " " + format.wiki.castNote : ""),
    user:
      `Extract every ${terms.castaway} and the starting ${terms.tribes} from this season's ` +
      `${terms.Castaways} section.\n\n` +
      sectionWikitext,
  });
  return { cast: parsed, usage };
}

// Per-episode extraction, worded and shaped by the show's format (format.wiki). max_tokens is higher
// than cast's because the output scales with episodes x people -- a full post-merge Survivor season
// runs to roughly a hundred events, most of them zero-votes-safes.
async function extractEpisodes(wikitext, terms, model, format) {
  const prompt = format.wiki.episodesPrompt(terms);
  const { parsed, usage } = await callModel({
    model: model || MODEL,
    schema: format.wiki.episodesSchema(z),
    schemaName: "episodes",
    maxTokens: 32000,
    system: prompt.system,
    user: prompt.user + "\n\n" + wikitext,
  });
  return { episodes: parsed, usage };
}

// ---------- validation ----------
// The schema guarantees SHAPE; this guards CONTENT. An LLM extraction is the one input to this app
// that can be confidently wrong, so a proposal only gets filed if it survives all of this -- and a
// failure rejects the whole run rather than filing a partially-trusted proposal for someone to
// rubber-stamp.
function validateCast(cast, state, terms) {
  const problems = [];
  const tribeNames = (cast.tribes || []).map((t) => (t.name || "").trim()).filter(Boolean);
  // A note, not a refusal. This used to be fatal, on the assumption that every show divides its cast
  // into groups -- true of Survivor, not true in general, and refusing the whole run leaves the
  // commissioner with nothing to look at instead of a cast list with no groupings. Nothing is applied
  // without their confirmation anyway, which is where a genuinely wrong extraction gets caught.
  if (!tribeNames.length) problems.push(`no ${terms.tribes} extracted`);
  if (new Set(tribeNames.map((n) => n.toLowerCase())).size !== tribeNames.length) {
    problems.push(`duplicate ${terms.tribe} names`);
  }

  const seen = new Set();
  const castaways = [];
  for (const c of cast.castaways || []) {
    const name = (c.name || "").trim();
    if (!name) { problems.push(`a ${terms.castaway} row had no name`); continue; }
    // Wiki names are people's names -- anything wild here means the extraction went off the rails.
    if (name.length > 60) { problems.push(`implausible ${terms.castaway} name: "${name.slice(0, 40)}..."`); continue; }
    const key = name.toLowerCase();
    if (seen.has(key)) { problems.push(`duplicate ${terms.castaway}: ${name}`); continue; }
    seen.add(key);

    let tribeName = c.tribeName ? String(c.tribeName).trim() : null;
    // A tribe the model named but the tribe list doesn't contain is exactly the kind of quiet
    // invention worth dropping: keep the castaway, drop the unbacked tribe link.
    if (tribeName && !tribeNames.some((t) => t.toLowerCase() === tribeName.toLowerCase())) {
      problems.push(`${terms.castaway} "${name}" referenced unknown ${terms.tribe} "${tribeName}" (link dropped)`);
      tribeName = null;
    }
    castaways.push({ name, tribeName, photoFile: c.photoFile ? String(c.photoFile).trim() : null });
  }

  if (castaways.length < 4) problems.push(`only ${castaways.length} ${terms.castaways} extracted -- too few to be a real season`);
  if (castaways.length > 40) problems.push(`${castaways.length} ${terms.castaways} extracted -- more than any real season`);

  // How much of this is actually new is the commissioner's main question, so compute it here rather
  // than making them diff two lists by eye.
  const existing = new Set(state.castaways.map((c) => c.name.trim().toLowerCase()));
  const newCastaways = castaways.filter((c) => !existing.has(c.name.toLowerCase()));

  // Notes vs. refusals: an unbacked grouping that got dropped, and a show with no groupings at all,
  // are both things a commissioner can see and judge for themselves in the review UI. Anything
  // structural -- a missing name, a duplicate, an implausible count -- refuses the run.
  const fatal = problems.filter((p) => !p.includes("(link dropped)") && !p.startsWith("no "));
  return { tribes: tribeNames.map((name) => ({ name })), castaways, newCount: newCastaways.length, problems, fatal };
}

// Same job as validateCast, for the per-episode extraction: the schema guarantees SHAPE, this guards
// CONTENT. There's more to guard here, because this extraction is inference over rowspan-heavy tables
// and footnote markers rather than a read off one well-formed table.
//
// Splits into two payloads rather than one, because the two halves don't deserve the same trust and a
// commissioner should be able to take eliminations without taking the event guesses. Each gets filed
// as its own proposal kind.
//
// Every name is resolved against THIS LEAGUE'S cast here, at extraction time, so a proposal that
// can't be applied never gets filed. Names (not ids) are what's stored, and apply resolves again --
// see applyEliminationsImport's comment for why.
function validateEpisodes(extracted, state, terms, format) {
  const problems = [];
  const fatal = [];
  // Names the wiki used that this league's cast doesn't have. Non-fatal (see resolve below) but
  // surfaced on its own, because a name dropped here is a result that will never be reviewed.
  const unmatched = [];
  // Results thrown out by the checks below (a zero-votes-safe for someone voted out that episode, an
  // individual immunity in a pre-merge episode, a duplicate). Each is a defensible refusal, but they
  // used to exist only as a console line -- so a castaway whose ONLY result was dropped vanished
  // from the review list with nothing said, and the commissioner had no way to know a name was
  // missing. Carried out of here so the reveal can say who and why.
  const dropped = [];
  const seenEpisodes = new Set();
  const eliminated = new Set(); // castaway ids claimed by an elimination in THIS proposal
  const epsOut = [];
  const eventsOut = [];
  let eventCount = 0;
  let lowConfidence = 0;
  // Subsets of `problems` worth surfacing on their own proposal (eliminations vs. scoringEvents),
  // since the two get reviewed separately -- `problems` itself still gets everything, for the
  // console log.
  const elimProblems = [];
  const eventProblems = [];

  // Resolves one wiki name, recording why it failed. Ambiguity is a refusal, not a coin flip: the
  // wiki prints short names in these tables, and two castaways can share one.
  //
  // A name that doesn't resolve is NOT fatal any more, and that's the important change. It used to
  // fail the entire run -- so one inferred zero-votes-safe naming somebody the extraction spelled
  // differently threw away that episode's eliminations too, and the commissioner got
  // "failed validation, nothing filed" with nothing they could act on. Now the decision that
  // couldn't be resolved is dropped and named, and everything that DID resolve still gets filed.
  // Unresolved names are collected separately from ordinary notes so callers can say so loudly:
  // a dropped elimination is a hole in the season, not a nit.
  const resolve = (name, where) => {
    const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, name);
    if (castaway) return castaway;
    const why = ambiguous
      ? `"${name}" (${where}) matches more than one ${terms.castaway}: ${ambiguous.join(", ")}`
      : `"${name}" (${where}) doesn't match any ${terms.castaway} in this league`;
    unmatched.push(why);
    problems.push(why);
    return null;
  };

  // Whether two of the read's names are the same person -- the vote grid and the cast table spell
  // people differently, so this compares who they resolve to, not the strings.
  const personKey = (name) => {
    const { castaway } = StateLogic.Core.findCastawayByName(state, name);
    return castaway ? castaway.id : String(name || "").trim().toLowerCase();
  };
  const same = (a, b) => personKey(a) === personKey(b);

  const merge = extracted.mergeEpisode;
  if (merge !== null && merge !== undefined && (!Number.isInteger(merge) || merge < 1)) {
    problems.push(`implausible merge episode ${merge} (ignored)`);
  }

  for (const ep of extracted.episodes || []) {
    const n = ep && ep.number;
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      fatal.push(`implausible episode number ${JSON.stringify(n)}`);
      continue;
    }
    if (seenEpisodes.has(n)) {
      fatal.push(`episode ${n} appears twice`);
      continue;
    }
    seenEpisodes.add(n);

    // postMerge is cross-checked against mergeEpisode rather than taken on trust, since they come
    // from the same read and disagreeing with itself is a sign the grid was misread.
    let postMerge = !!ep.postMerge;
    if (Number.isInteger(merge) && merge >= 1) {
      const expected = n >= merge;
      if (expected !== postMerge) {
        problems.push(`episode ${n} said postMerge=${postMerge} but the merge is episode ${merge} -- using ${expected}`);
        postMerge = expected;
      }
    }

    const elims = [];
    for (const el of ep.eliminations || []) {
      const c = resolve(el && el.name, `episode ${n} elimination`);
      if (!c) continue;
      // The same person leaving twice is nonsense, and it would corrupt placement order.
      if (eliminated.has(c.id)) {
        fatal.push(`${c.name} is eliminated more than once (episode ${n})`);
        continue;
      }
      eliminated.add(c.id);
      elims.push({ name: c.name, method: el.method });
    }
    // Double boots are real but rare and always explicit -- more than one is exactly the shape a
    // misread rowspan/vote-count cell would produce (see extractEpisodes' prompt), so it's surfaced
    // as a note for the commissioner rather than silently trusted like a single elimination is.
    // A finale legitimately has several (runners-up, fire-making, the winner), so it isn't flagged.
    const finale = elims.some((e) => e.method === format.winnerExitMethod);
    if (!finale && elims.length > (format.wiki.routineEliminations || 1)) {
      const msg = `episode ${n} has ${elims.length} eliminations (${elims.map((e) => e.name).join(", ")}) -- double-check this against the source before applying`;
      problems.push(msg);
      elimProblems.push(msg);
    }

    // Informational only -- never applied to league state (applyEliminationsImport only reads
    // .eliminations/.title/.airDate off each episode). Exists purely so the model has a valid slot
    // for an Exile Island-style twist instead of it getting swept into eliminations by mistake.
    const exiledOut = [];
    for (const ex of ep.exiled || []) {
      const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, ex && ex.name);
      if (castaway) exiledOut.push(castaway.name);
      else {
        const msg = `"${ex && ex.name}" (episode ${n} exiled) ${ambiguous ? `matches more than one ${terms.castaway}` : `doesn't match any ${terms.castaway} in this league`} -- dropped`;
        problems.push(msg);
        elimProblems.push(msg);
      }
    }

    // The read's own events, plus any the format works out from the rest of it (The Traitors: Round
    // Table outcomes from the recorded votes), all held to the same checks below.
    const derived = format.wiki.derivedEvents ? format.wiki.derivedEvents(ep, extracted, same) : [];
    const evs = [];
    for (const sev of [...(ep.events || []), ...derived]) {
      const c = resolve(sev && sev.name, `episode ${n} ${sev && sev.type}`);
      if (!c) continue;
      // The format's own sanity checks (Survivor: no zero-votes-safe for someone voted out that
      // episode, no individual immunity before the merge).
      const rejected = format.wiki.rejectEvent({ type: sev.type, name: c.name, episode: n, eliminated: eliminated.has(c.id), postMerge });
      if (rejected) {
        problems.push(rejected.problem); eventProblems.push(rejected.problem);
        dropped.push({ name: c.name, episode: n, why: rejected.why });
        continue;
      }
      const key = `${n}|${sev.type}|${c.id}`;
      if (evs.some((x) => `${n}|${x.type}|${x.castawayKey}` === key)) {
        const msg = `duplicate ${sev.type} for ${c.name} in episode ${n} (kept once)`;
        problems.push(msg); eventProblems.push(msg);
        dropped.push({ name: c.name, episode: n, why: `the same ${sev.type} was reported twice (kept once)` });
        continue;
      }
      const confidence = sev.confidence === "high" ? "high" : "low";
      if (confidence === "low") lowConfidence++;
      evs.push({ name: c.name, type: sev.type, confidence, castawayKey: c.id });
      eventCount++;
    }

    if (elims.length || exiledOut.length) {
      epsOut.push({
        number: n, postMerge, title: ep.title || null, airDate: ep.airDate || null,
        eliminations: elims, ...(exiledOut.length ? { exiled: exiledOut } : {})
      });
    }
    if (evs.length) {
      eventsOut.push({
        number: n,
        postMerge,
        events: evs.map(({ name, type, confidence }) => ({ name, type, confidence })),
      });
    }
  }

  // Tribe/team changes (swaps, merges, new teams, weekly pairs, playing alone). Someone already out in
  // an EARLIER episode can't move, which is the likeliest misread (a row's later colour cells); moving
  // and leaving in the same episode is real (the first boot after a merge). A pair is named both ways
  // round by its two members, so it's put in one order here to make them the same group.
  const exitEpisode = new Map();
  for (const ep of extracted.episodes || []) {
    for (const el of ep.eliminations || []) {
      const { castaway } = StateLogic.Core.findCastawayByName(state, el && el.name);
      if (castaway && !(exitEpisode.get(castaway.id) <= ep.number)) exitEpisode.set(castaway.id, ep.number);
    }
  }
  const groupLabel = (g) => {
    const label = String(g == null ? "" : g).trim();
    return label.includes(" & ") ? label.split("&").map((s) => s.trim()).filter(Boolean).sort().join(" & ") : label;
  };
  const groupsOut = [];
  for (const ep of extracted.episodes || []) {
    const n = ep && ep.number;
    if (!Number.isInteger(n)) continue;
    for (const gc of ep.groupChanges || []) {
      const c = resolve(gc && gc.name, `episode ${n} group change`);
      if (!c) continue;
      if (exitEpisode.has(c.id) && exitEpisode.get(c.id) < n) {
        const msg = `dropped ${c.name}'s move to ${groupLabel(gc.group) || "no group"} in episode ${n} -- they left in episode ${exitEpisode.get(c.id)}`;
        problems.push(msg); elimProblems.push(msg);
        continue;
      }
      if (groupsOut.some((x) => x.episode === n && x.castawayKey === c.id)) continue;
      groupsOut.push({ episode: n, name: c.name, group: groupLabel(gc.group), castawayKey: c.id });
    }
  }

  // Secret roles (The Traitors), resolved like everything else. One per person: the earliest wins,
  // since a role once taken holds until another decision says otherwise.
  const rolesOut = [];
  const roleClaims = format.wiki.roles ? format.wiki.roles(extracted) : [];
  for (const r of [...roleClaims].sort((a, b) => a.episode - b.episode)) {
    if (!Number.isInteger(r.episode) || r.episode < 1) continue;
    const c = resolve(r.name, `episode ${r.episode} ${r.role}`);
    if (!c) continue;
    if (rolesOut.some((x) => x.castawayKey === c.id)) {
      const msg = `${c.name} is listed as ${r.role} more than once (kept episode ${rolesOut.find((x) => x.castawayKey === c.id).episode})`;
      problems.push(msg); elimProblems.push(msg);
      continue;
    }
    rolesOut.push({ episode: r.episode, name: c.name, role: r.role, castawayKey: c.id });
  }

  if (!epsOut.length && !eventsOut.length && !rolesOut.length && !groupsOut.length && !unmatched.length) fatal.push("nothing extracted at all");

  // How much of this is new is the commissioner's actual question, so compute it rather than making
  // them diff by eye.
  let newEliminations = 0;
  for (const ep of epsOut) {
    for (const el of ep.eliminations) {
      const { castaway } = StateLogic.Core.findCastawayByName(state, el.name);
      if (castaway && castaway.status !== "eliminated") newEliminations++;
    }
  }

  return {
    unmatched,
    dropped,
    eliminations: { episodes: epsOut, mergeEpisode: Number.isInteger(merge) ? merge : null, problems: elimProblems },
    scoringEvents: { episodes: eventsOut, mergeEpisode: Number.isInteger(merge) ? merge : null, problems: eventProblems },
    roles: rolesOut.map(({ episode, name, role }) => ({ episode, name, role })),
    groups: groupsOut.map(({ episode, name, group }) => ({ episode, name, group })),
    counts: {
      episodes: seenEpisodes.size,
      eliminations: epsOut.reduce((a, e) => a + e.eliminations.length, 0),
      newEliminations,
      events: eventCount,
      lowConfidence,
    },
    problems,
    fatal,
  };
}

// Finds a section and pulls in anything it transcludes, in one step. Returns null when the page has
// no such section -- callers decide whether that's fatal.
async function sectionWithTables(page, candidates, apiUrl) {
  const found = findSection(page.wikitext, candidates);
  if (!found) return null;
  const expanded = await expandTranscludedTables(found.text, apiUrl);
  return { title: found.title, text: expanded.text, pages: expanded.pages };
}

// ---------- cast import (phase 1) ----------
// SEASON-scoped half: read the wiki and ask the model what it says. Nothing here depends on any
// league, which is exactly why it can be cached and shared -- see cachedExtraction.
async function extractCastForSeason(pool, ctx, opts) {
  const { page, apiUrl, terms, castawayTerm, entry, showSlug, season, showId } = ctx;

  // Which heading holds the cast is a per-show question, not a constant. See castSectionCandidates:
  // the show's own castaway_term drives the guess, with shows.cast_section_heading as the override.
  const candidates = castSectionCandidates(castawayTerm, entry.cast_section_heading);
  const section = findSection(page.wikitext, candidates);
  if (!section) {
    // Name what was looked for AND what the page actually has. The old message said only
    // `No ==Castaways== section found`, which gave an admin no way to tell whether the page was
    // wrong, the heading was spelled differently, or the wiki uses another word entirely.
    throw new Error(sectionNotFound("cast", page, candidates) + "\nSet the right one as the Cast section in Admin > Shows & Seasons.");
  }
  const expanded = await expandTranscludedTables(section.text, apiUrl);
  // The format words part of the cast prompt (castNote), so a read under another one isn't reused.
  const provenance = baseProvenance(showSlug, season, page, apiUrl, expanded.pages, { castSection: section.title, format: ctx.format.id });

  const reusable = await cachedExtraction(pool, showId, season, "cast", provenance, opts);
  if (reusable) return reusable;

  console.log(
    `[wiki-sync] "${section.title}" section: ${expanded.text.length} chars (rev ${page.revisionId})` +
      (section.matched.toLowerCase() === section.title.toLowerCase() ? "" : ` [matched "${section.matched}"]`)
  );
  const { cast, usage } = await extractCast(expanded.text, terms, opts.model, ctx.format);
  logUsage(usage);
  // What this read actually cost to make, for the admin panel's cost line.
  provenance.model = usage.model;
  provenance.usage = {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens || 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
  };

  // Resolved here rather than per-league: a File: name maps to the same URL for everyone, so this
  // is one more wiki read that only has to happen once per season. validateCast still sees the raw
  // photoFile (unchanged); the fan-out below maps it through this.
  const photos = await resolvePhotoUrls((cast.castaways || []).map((c) => c.photoFile), apiUrl);
  return storeExtraction(pool, showId, season, "cast", { ...cast, photos }, provenance, opts);
}

// SEASON-scoped half for the cast: stage what the model extracted into `season_cast` for an admin
// to review and approve (db/migrations/0011). Unlike episodes, this fans out to NOBODY -- a cast is
// a fact about the show, identical for every league playing the season, so it's reviewed once by
// the person who catalogued the season rather than once per commissioner. Approving it (POST
// /api/admin/seasons/:id/cast/approve) is what puts castaways into leagues.
//
// Staging is ADDITIVE and never overwrites a row that's already there. That's what makes a re-pull
// safe: an admin who cleared the tribes (so a catching-up league can't see the starting division)
// or corrected a name doesn't lose that work when the connector reads the page again. New people --
// a late replacement, a row the first extraction missed -- are inserted, and their arrival un-
// approves the season, because a cast that changed since it was last looked at needs looking at.
async function stageSeasonCast(pool, ctx, extraction, opts) {
  const { photos = {}, ...cast } = extraction.payload;
  const { terms, season, showSlug } = ctx;
  // Validated against an EMPTY league state: this is the season's cast, not any league's, so the
  // "how many of these are new to you" half of validateCast has nothing to compare against here.
  const checked = validateCast(cast, { castaways: [] }, terms);
  checked.problems.forEach((p) => console.log(`[wiki-sync]   note: ${p}`));
  if (checked.fatal.length) {
    throw new Error(`failed validation, nothing staged:\n    - ${checked.fatal.join("\n    - ")}`);
  }

  // The order an admin reviews in, and the order leagues receive: grouped by starting tribe in the
  // order the wiki's table introduced them, then alphabetically. NOT the table's own row order,
  // which on most season pages is FINISH order -- first boot at the top, winner at the bottom -- and
  // would hand every league the season's placement order in the cast list itself.
  const tribeRank = new Map(checked.tribes.map((t, i) => [t.name.toLowerCase(), i]));
  const ordered = [...checked.castaways].sort((a, b) => {
    const ra = a.tribeName ? tribeRank.get(a.tribeName.toLowerCase()) ?? checked.tribes.length : checked.tribes.length;
    const rb = b.tribeName ? tribeRank.get(b.tribeName.toLowerCase()) ?? checked.tribes.length : checked.tribes.length;
    return ra - rb || a.name.localeCompare(b.name);
  });

  const { rows: seasonRows } = await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.slug = $1 AND ss.season_number = $2`,
    [showSlug, season]
  );
  if (!seasonRows.length) {
    // A league can track a season nobody catalogued (the free-text season field), and the connector
    // will happily read it -- but there's no row to hang a reviewable cast off, so say which one to
    // add rather than failing obscurely.
    throw new Error(
      `${showSlug} season ${season} isn't in the catalog, so there's nowhere to stage its cast. ` +
        `Add the season in Admin > Shows & Seasons first.`
    );
  }
  const seasonId = seasonRows[0].id;

  if (opts.dry) {
    console.log(`[wiki-sync]   --dry: would stage ${ordered.length} ${terms.castaways} for review`);
    return { filed: false, staged: 0, total: ordered.length, summary: `${ordered.length} ${terms.castaways} — dry run, nothing staged` };
  }

  let added = 0;
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i];
    // COALESCE, not EXCLUDED: a value already on the row wins, so an admin's correction survives a
    // re-pull -- but a BLANK one gets filled in. That second half is the recovery path for a season
    // whose tribes were wiped by 0011's old "clear all tribes" button, and for a first pull that ran
    // before the wiki listed tribes at all.
    const { rows: upserted } = await pool.query(
      `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (season_id, lower(name)) DO UPDATE
          SET tribe_name = COALESCE(season_cast.tribe_name, EXCLUDED.tribe_name),
              photo_url  = COALESCE(season_cast.photo_url,  EXCLUDED.photo_url)
       RETURNING (xmax = 0) AS inserted`,
      [seasonId, c.name, c.tribeName, normalizePhotoUrl(c.photoFile && photos[c.photoFile]), i]
    );
    if (upserted[0] && upserted[0].inserted) added += 1;
  }
  // Only a change re-opens the review. An unchanged re-pull of an already-approved season leaves it
  // approved, so the nightly job can't quietly withdraw a cast leagues are already playing with.
  if (added) {
    await pool.query("UPDATE show_seasons SET cast_approved_at=NULL, cast_approved_by=NULL, updated_at=now() WHERE id=$1", [seasonId]);
  }
  const { rows: totalRows } = await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id=$1", [seasonId]);
  const total = totalRows[0].n;
  const summary =
    `${total} ${terms.castaways} staged for review` +
    (added ? ` (${added} new — needs approving in Admin > Shows & Seasons)` : " (nothing new; approval unchanged)");
  console.log(`[wiki-sync]   ${summary}`);
  return { filed: added > 0, staged: added, total, seasonId, summary };
}

// ---------- per-episode import (phase 2) ----------
// SEASON-scoped half: reads the vote grid AND the episode guide in one model call (it needs both --
// who left comes from the vote table's terminal cells and the guide's Finish column, while immunity
// and reward wins are only in the guide).
async function extractEpisodesForSeason(pool, ctx, opts) {
  const { page, apiUrl, terms, showSlug, season, showId, format } = ctx;
  const { voteSections, guideSections } = format.wiki;

  const votes = await sectionWithTables(page, voteSections, apiUrl);
  const guide = await sectionWithTables(page, guideSections, apiUrl);
  if (!votes && !guide) {
    throw new Error(
      sectionNotFound("per-episode", page, [...voteSections, ...guideSections]) +
        "\nThis command needs a voting table, an episode guide, or both."
    );
  }
  if (!votes) console.log(`[wiki-sync] ${format.wiki.missingVotesNote}`);
  if (!guide) console.log(`[wiki-sync] ${format.wiki.missingGuideNote}`);

  // Sections a format wants read before the tables (The Challenge: the season's own ==Format==, since
  // its rules change every season, and ==Episodes== for titles and air dates). First, so the model
  // knows the rules before it reads the results. Their templates count towards the cache's revision
  // check like any other page read.
  const context = [];
  for (const name of format.wiki.contextSections || []) {
    const found = await sectionWithTables(page, [name], apiUrl);
    if (found) context.push(found);
  }

  const parts = context.map((c) => c.text);
  if (guide) parts.push(guide.text);
  if (votes) parts.push(votes.text);
  const combined = parts.join("\n\n");
  const readPages = [...context.flatMap((c) => c.pages), ...(guide ? guide.pages : []), ...(votes ? votes.pages : [])];
  const provenance = baseProvenance(showSlug, season, page, apiUrl, readPages, {
    sections: [...context.map((c) => c.title), guide && guide.title, votes && votes.title].filter(Boolean),
    // The format shaped the read (its schema and prompt), so a read made under another one -- or an
    // older version of this one -- can't be reused. See cachedExtraction.
    format: format.id,
    formatVersion: format.wiki.version || 1,
  });

  const reusable = await cachedExtraction(pool, showId, season, "episodes", provenance, opts);
  if (reusable) return reusable;

  console.log(
    `[wiki-sync] sections: ${[guide && guide.title, votes && votes.title].filter(Boolean).join(" + ")} ` +
      `-> ${combined.length} chars across ${readPages.length + 1} page(s)`
  );
  const { episodes, usage } = await extractEpisodes(combined, terms, opts.model, format);
  logUsage(usage);
  // What this read actually cost to make, for the admin panel's cost line.
  provenance.model = usage.model;
  provenance.usage = {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens || 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
  };
  return storeExtraction(pool, showId, season, "episodes", episodes, provenance, opts);
}

// SEASON-scoped half for episode results: resolve the extraction against the season's own cast and
// stage each elimination / scoring event / exile as a SEASON decision (db/migrations/0019) for an
// admin to decide once. Nothing reaches a league from here -- accepting a decision is what does, via
// src/lib/server/season-decisions.ts.
//
// The three kinds come from two halves of `checked`, which are NOT equally trustworthy -- eliminations
// and exiles are read off stated columns, scoring events are inference over a rowspan-heavy grid and
// footnote markers. That difference rides on each decision's own `confidence`.
async function stageSeasonEpisodes(pool, ctx, extraction, opts = {}) {
  const seasonId = await decisions.seasonIdFor(pool, ctx.showId, ctx.season);
  if (!seasonId) {
    throw new Error(`${ctx.showSlug} season ${ctx.season} isn't in the catalog -- add it in Admin > Shows & Seasons first.`);
  }
  // Names resolve against the season's cast, so with no cast every name would fail. Say that rather
  // than reporting dozens of unmatched names.
  const castState = await decisions.seasonCastState(pool, seasonId);
  if (!castState.castaways.length) {
    throw new Error(
      `No ${ctx.terms.castaways} for this season yet -- pull and approve the cast first; results are matched to it by name.`
    );
  }

  const checked = validateEpisodes(extraction.payload, castState, ctx.terms, ctx.format);
  checked.problems.forEach((p) => console.log(`[wiki-sync]   note: ${p}`));
  if (checked.fatal.length) {
    throw new Error(`failed validation, nothing staged:\n    - ${checked.fatal.join("\n    - ")}`);
  }

  // One flat list of decisions, from both halves of the validated result. `exiled` rides along on the
  // eliminations half (it comes off the same read) but is its own kind -- it records a fact and
  // scores nothing, see EpisodeLogic.addExiled.
  const items = [];
  for (const ep of checked.eliminations.episodes) {
    for (const el of ep.eliminations) {
      items.push({ episode: ep.number, postMerge: ep.postMerge, kind: "elimination", name: el.name, method: el.method, eventType: "", confidence: "high" });
    }
    for (const name of ep.exiled || []) {
      items.push({ episode: ep.number, postMerge: ep.postMerge, kind: "exiled", name, method: "", eventType: "", confidence: "high" });
    }
  }
  for (const ep of checked.scoringEvents.episodes) {
    for (const ev of ep.events) {
      items.push({ episode: ep.number, postMerge: ep.postMerge, kind: "event", name: ev.name, method: "", eventType: ev.type, confidence: ev.confidence });
    }
  }
  // Roles read off a stated column (the Contestants table's Faction), so as trustworthy as an exit.
  for (const r of checked.roles) {
    items.push({ episode: r.episode, postMerge: false, kind: "role", name: r.name, method: r.role, eventType: "", confidence: "high" });
  }
  // Group changes: the new group's name in `method`, "" for playing as an individual. Worked out from
  // spans and colour cells rather than read off one column, so reviewed as inferred.
  const merge = checked.eliminations.mergeEpisode;
  for (const g of checked.groups) {
    const postMerge = Number.isInteger(merge) && g.episode >= merge;
    items.push({ episode: g.episode, postMerge, kind: "group", name: g.name, method: g.group, eventType: "", confidence: "low" });
  }

  // Named in the result rather than buried in the console: results nobody will ever see unless the
  // cast (or the wiki) is fixed.
  const unmatched = checked.unmatched
    .map((u) => (u.match(/^"([^"]+)"/) || [])[1])
    .filter(Boolean)
    .filter((name, i, all) => all.indexOf(name) === i);

  const c = checked.counts;
  const counts =
    `${items.length} results across ${c.episodes} episodes ` +
    `(${c.eliminations} eliminations; ${c.events} events, ${c.lowConfidence} low-confidence)` +
    (unmatched.length ? ` — ${unmatched.length} couldn't be matched to the cast: ${unmatched.join(", ")}` : "");
  console.log(`[wiki-sync]   ${counts}`);
  if (opts.dry) {
    return { summary: `${counts} — dry run, nothing staged`, inserted: 0, updated: 0, withdrawn: 0, unmatched, dropped: checked.dropped };
  }

  const r = await decisions.stageDecisions(pool, seasonId, items, "wiki", extraction.id);
  const summary =
    `${counts} — ${r.inserted} new to review` +
    (r.withdrawn ? `, ${r.withdrawn} withdrawn (no longer on the wiki)` : "");
  console.log(`[wiki-sync]   ${summary}`);
  return { summary, ...r, unmatched, dropped: checked.dropped };
}

// ---------- shared helpers ----------
function sectionNotFound(what, page, candidates) {
  const found = listHeadings(page.wikitext).map((h) => h.title);
  return (
    `No ${what} section found on "${page.title}".\n` +
    `  looked for: ${candidates.join(", ")}\n` +
    `  page has:   ${found.length ? found.join(", ") : "(no headings at all)"}`
  );
}

function logUsage(usage) {
  if (usage) console.log(`[wiki-sync] tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`);
}

// LLM extraction isn't reproducible from its inputs, so a proposal has to carry what was actually
// read. `pages` lists EVERY page, transcluded templates included -- with transclusion the season
// page's own revision id no longer pins the content.
function baseProvenance(showSlug, season, page, apiUrl, extraPages, extra) {
  return {
    // Which show, not just which season: with a multi-show catalog, "season 44" alone no longer
    // identifies what was read.
    showSlug,
    seasonNumber: season,
    model: MODEL, // overwritten with the model actually used, once known (see extract*ForSeason)
    extractedAt: new Date().toISOString(),
    pages: [{ title: page.title, revisionId: page.revisionId, apiUrl }, ...(extraPages || [])],
    ...(extra || {}),
  };
}

// ---------- the per-season extraction cache (db/migrations/0009) ----------
// Returns a reusable cached extraction, or null if this season has to be read again.
//
// "Has the wiki changed?" is answered exactly, by revision id, not by a TTL: every page the run just
// fetched (season page plus every transcluded template) carries one, and provenance already records
// them. Same revisions in, same extraction out -- so a nightly job over a finished season makes zero
// model calls forever, while an edit anywhere in the source is picked up the very next night.
//
// This is what keeps the cache from being a trap: caching on time alone would either re-read a
// static season for no reason or, worse, never notice a new episode.
async function cachedExtraction(pool, showId, season, kind, provenance, opts) {
  if (opts.force) return null;
  const { rows } = await pool.query(
    "SELECT id, payload, provenance, extracted_at FROM wiki_extractions WHERE show_id=$1 AND season_number=$2 AND kind=$3",
    [showId, season, kind]
  );
  if (!rows.length) return null;
  const cached = rows[0];
  if (!sameRevisions(cached.provenance.pages, provenance.pages)) return null;
  // Same pages read under a different format (the show was switched) is a different read. Reads from
  // before formats recorded none, and were all made under the default.
  if (provenance.format && (cached.provenance.format || Formats.DEFAULT_FORMAT) !== provenance.format) return null;
  // A format whose read has since learned to ask for more (its wiki.version went up) reads again once,
  // so a finished season picks up the new fields too -- not only a season whose wiki keeps changing.
  if (provenance.formatVersion && (cached.provenance.formatVersion || 1) < provenance.formatVersion) return null;
  console.log(
    `[wiki-sync] ${kind}: wiki unchanged since ${new Date(cached.extracted_at).toISOString()} -- reusing cached extraction (no model call)`
  );
  // `cached` is carried on the result so a caller with a UI (the admin Pull buttons) can say whether
  // the wiki was actually re-read -- otherwise a --force run and a cache hit look identical from
  // outside, and "nothing changed" reads as "the button did nothing".
  return { id: cached.id, payload: cached.payload, provenance: cached.provenance, cached: true };
}

function sameRevisions(a, b) {
  const key = (pages) =>
    (pages || [])
      .map((p) => `${p.title}@${p.revisionId}`)
      .sort()
      .join("|");
  return key(a) === key(b) && key(a) !== "";
}

async function storeExtraction(pool, showId, season, kind, payload, provenance, opts) {
  if (opts.dry) {
    console.log(`[wiki-sync] --dry: not caching the ${kind} extraction`);
    return { id: null, payload, provenance, cached: false };
  }
  const { rows } = await pool.query(
    `INSERT INTO wiki_extractions (show_id, season_number, kind, payload, provenance)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
     ON CONFLICT (show_id, season_number, kind)
     DO UPDATE SET payload=EXCLUDED.payload, provenance=EXCLUDED.provenance, extracted_at=now()
     RETURNING id`,
    [showId, season, kind, JSON.stringify(payload), JSON.stringify(provenance)]
  );
  return { id: rows[0].id, payload, provenance, cached: false };
}

// One pending proposal per league per kind (partial unique index), so a second scheduled run before
// anyone reviews replaces its own earlier suggestion instead of queueing a duplicate.
async function fileProposal(pool, leagueId, kind, payload, provenance) {
  await pool.query(
    `INSERT INTO wiki_proposals (league_id, kind, payload, provenance)
     VALUES ($1,$2,$3::jsonb,$4::jsonb)
     ON CONFLICT (league_id, kind) WHERE status='pending'
     DO UPDATE SET payload=EXCLUDED.payload, provenance=EXCLUDED.provenance, created_at=now()`,
    [leagueId, kind, JSON.stringify(payload), JSON.stringify(provenance)]
  );
}

// ---------- main ----------
const EXTRACTORS = { cast: extractCastForSeason, episodes: extractEpisodesForSeason };

// Everything needed to read one season, derived from the catalog rather than from any league --
// which is the whole reason this is its own function now. Two leagues on the same season resolve to
// byte-identical context, so the read below them can be shared.
async function resolveSeasonContext(pool, showSlug, season, label) {
  // The admin-managed catalog (db/migrations/0006_shows_and_seasons.sql): the season row carries the
  // wiki page title an admin entered, and the show row the API endpoint for that show's wiki --
  // which is the point, since different shows live on different wikis.
  const { rows: catalog } = await pool.query(
    `SELECT s.id AS show_id, ss.wiki_page_title, ss.name AS season_name,
            s.name AS show_name, s.wiki_api_url, s.castaway_term, s.tribe_term, s.cast_section_heading, s.format
       FROM shows s LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number = $2
      WHERE s.slug = $1`,
    [showSlug, season]
  );
  // No row for the slug at all means the show was deleted out from under this league. Refuse rather
  // than fall back, because the fallback used to be Survivor's wiki -- a wrong answer that looks like
  // a working one.
  if (!catalog.length) {
    throw new Error(
      `${label} points at show "${showSlug}", which isn't in the catalog. ` +
        `Re-add it in Admin > Shows & Seasons, or pick a different show in League Settings.`
    );
  }
  const entry = catalog[0];
  const pageTitle = entry.wiki_page_title || `${entry.show_name} ${season}`;
  const apiUrl = entry.wiki_api_url;
  if (!apiUrl) {
    throw new Error(
      `Show "${entry.show_name}" has no wiki API endpoint. Add one (or add a season with its wiki ` +
        `URL, which fills it in) in Admin > Shows & Seasons.`
    );
  }
  // The show's own vocabulary, used both to guess the cast section heading and to word the
  // extraction prompt.
  const { terms, castawayTerm, tribeTerm } = termsFor(entry);
  if (!entry.wiki_page_title) {
    console.log(
      `[wiki-sync] no catalog page title for ${showSlug} season ${season} -- guessing "${pageTitle}". ` +
        `Add the season's wiki URL in Admin > Shows & Seasons to make this exact.`
    );
  }
  console.log(`[wiki-sync] ${showSlug} season ${season} -> ${pageTitle} (${apiUrl})`);
  const page = await fetchWikitext(pageTitle, apiUrl);
  return { showId: entry.show_id, showSlug, season, entry, page, apiUrl, terms, castawayTerm, tribeTerm, format: Formats.formatFor(entry.format) };
}

function leagueSeasonOf(league) {
  const settings = (league.state && league.state.settings) || {};
  return { showSlug: settings.showId, season: settings.wikiSeason };
}

// One league, one kind -- the shape the CLI has always had. The league only names the season now:
// extract for it (cache-aware) and stage for admin review, same as the season path.
async function runForLeague(pool, command, leagueId, opts) {
  if (!EXTRACTORS[command]) {
    throw new Error(`Unknown command "${command}". Supported: ${Object.keys(EXTRACTORS).join(", ")}, all`);
  }
  const { rows } = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new Error(`No league with id ${leagueId}`);
  const league = rows[0];
  const { showSlug, season } = leagueSeasonOf(league);
  if (!season) {
    throw new Error(
      `League "${league.name}" has no wikiSeason set. Set it in League Settings first -- this won't guess which season you mean.`
    );
  }
  if (!showSlug) {
    throw new Error(
      `League "${league.name}" has no show set. Pick one in League Settings first -- this used to ` +
        `assume Survivor, which is exactly how a Traitors league ends up fetching the wrong wiki.`
    );
  }
  const ctx = await resolveSeasonContext(pool, showSlug, season, `League "${league.name}"`);
  const extraction = await EXTRACTORS[command](pool, ctx, opts);
  // `cast <leagueId>` now stages that league's SEASON for admin review rather than filing a
  // proposal for this one league -- the cast stopped being per-league in db/migrations/0011. The
  // command keeps taking a league id because a league is still how you say which season you mean.
  if (command === "cast") await stageSeasonCast(pool, ctx, extraction, opts);
  else await stageSeasonEpisodes(pool, ctx, extraction, opts);
}

/**
 * Re-stages a season's episode decisions from the extraction already cached for it -- no wiki read,
 * no model call. For a season whose results were read before decisions moved to the season
 * (db/migrations/0019), so its review isn't empty until someone pays to pull again. Null when
 * nothing is cached.
 */
async function stageCachedSeasonEpisodes(pool, seasonId) {
  const { rows } = await pool.query(
    `SELECT we.id, we.payload, we.provenance, s.id AS show_id, s.slug, s.castaway_term, s.tribe_term, s.format, ss.season_number
       FROM show_seasons ss
       JOIN shows s ON s.id = ss.show_id
       JOIN wiki_extractions we ON we.show_id = s.id AND we.season_number = ss.season_number AND we.kind = 'episodes'
      WHERE ss.id = $1`,
    [seasonId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  // The format the read was made under, which is what its payload's shape follows.
  const format = Formats.formatFor(row.provenance.format || row.format);
  const ctx = { showId: row.show_id, showSlug: row.slug, season: row.season_number, terms: termsFor(row).terms, format };
  return stageSeasonEpisodes(pool, ctx, { id: row.id, payload: row.payload, provenance: row.provenance, cached: true });
}

// One SEASON, one kind -- what the admin catalog's per-season "Pull cast"/"Pull episodes" buttons
// call (POST /api/admin/seasons/:id/sync). This is `all` narrowed to a single season rather than
// `runForLeague` widened: the catalog row an admin clicks IS a (show, season), and the expensive
// half of the work is already season-scoped, so the natural unit here is the season -- extract once
// and stage the results for review, however many leagues play it (including none).
//
// Returns a structured result instead of only logging, because a route has to answer the request
// with what happened. `opts.batch` is deliberately NOT set: asking for a pull IS the reason to see
// the proposal, exactly as an explicit single-league CLI run is.
//
// One league's failure (no cast yet, a name that matches nobody) is reported against that league and
// doesn't deny the others a result they'd have got fine -- same rule as runAll.
async function runForSeason(pool, showSlug, season, kind, opts = {}) {
  if (!EXTRACTORS[kind]) {
    throw new Error(`Unknown kind "${kind}". Supported: ${Object.keys(EXTRACTORS).join(", ")}`);
  }
  const ctx = await resolveSeasonContext(pool, showSlug, season, `Season ${showSlug} ${season}`);
  const extraction = await EXTRACTORS[kind](pool, ctx, opts);
  const provenance = {
    cached: !!extraction.cached,
    pages: (extraction.provenance.pages || []).map((p) => ({ title: p.title, revisionId: p.revisionId })),
    // Null on a cache hit: nothing was spent this time.
    model: extraction.cached ? null : extraction.provenance.model || null,
    usage: extraction.cached ? null : extraction.provenance.usage || null,
  };

  // The cast is staged once for the season and reviewed by an admin (see stageSeasonCast); approving
  // it is what reaches the leagues.
  if (kind === "cast") {
    const staged = await stageSeasonCast(pool, ctx, extraction, opts);
    return { kind, showSlug, season, ...provenance, staged, leagues: [] };
  }

  // Episode results are staged once for the season too, for an admin to decide (db/migrations/0019);
  // accepting them is what reaches the leagues.
  const decisionsStaged = await stageSeasonEpisodes(pool, ctx, extraction, opts);
  return { kind, showSlug, season, ...provenance, staged: null, decisions: decisionsStaged, leagues: [] };
}

// The batch job (see .github/workflows/wiki-sync.yml). Reads each season ONCE and fans it out to
// every league tracking it -- the whole point of the 0009 rework. Ten leagues on Survivor 51 cost
// one model call between them, not ten.
async function runAll(pool, opts) {
  const { rows: leagues } = await pool.query(
    `SELECT id, name, state FROM leagues
      WHERE state->'settings'->>'showId' IS NOT NULL
        AND state->'settings'->>'wikiSeason' IS NOT NULL
      ORDER BY name`
  );
  if (!leagues.length) {
    console.log("[wiki-sync] no leagues have a show and season set -- nothing to do.");
    return;
  }

  // Group by what's actually being read, not by league.
  const groups = new Map();
  for (const league of leagues) {
    const { showSlug, season } = leagueSeasonOf(league);
    const key = `${showSlug}|${season}`;
    if (!groups.has(key)) groups.set(key, { showSlug, season, leagues: [] });
    groups.get(key).leagues.push(league);
  }
  console.log(`[wiki-sync] ${leagues.length} league(s) across ${groups.size} season(s)`);

  let failures = 0;
  for (const { showSlug, season, leagues: members } of groups.values()) {
    console.log(`\n[wiki-sync] === ${showSlug} season ${season} (${members.length} league(s)) ===`);
    let ctx;
    try {
      ctx = await resolveSeasonContext(pool, showSlug, season, `Season ${showSlug} ${season}`);
    } catch (e) {
      // A broken catalog entry takes out its own season's leagues and nothing else.
      console.error(`[wiki-sync] ${showSlug} season ${season}: ${e.message}`);
      failures++;
      continue;
    }
    for (const kind of ["cast", "episodes"]) {
      let extraction;
      try {
        extraction = await EXTRACTORS[kind](pool, ctx, opts);
      } catch (e) {
        // A season with no vote table yet (or no cast section) shouldn't stop the other kind, or the
        // other seasons -- an unaired season legitimately has nothing to read yet.
        console.error(`[wiki-sync] ${showSlug} season ${season} ${kind}: ${e.message}`);
        failures++;
        continue;
      }
      // Both kinds are season data, staged once for an admin to review -- see stageSeasonCast and
      // stageSeasonEpisodes. Nothing here touches a league.
      try {
        if (kind === "cast") await stageSeasonCast(pool, ctx, extraction, opts);
        else await stageSeasonEpisodes(pool, ctx, extraction, opts);
      } catch (e) {
        console.error(`[wiki-sync] ${showSlug} season ${season} ${kind}: ${e.message}`);
        failures++;
      }
    }
  }
  console.log(failures ? `\n[wiki-sync] done, with ${failures} failure(s) above.` : "\n[wiki-sync] done.");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const [command, leagueId] = args.filter((a) => !a.startsWith("--"));
  const opts = { dry: flags.includes("--dry"), force: flags.includes("--force") };
  // `all` takes no league id -- it works out which leagues to touch itself.
  const usable = command === "all" ? true : !!(command && leagueId);
  if (!usable) {
    console.error(
      "usage: node db/wiki-sync.js all [--force] [--dry]\n" +
        "       node db/wiki-sync.js <cast|episodes> <leagueId> [--force] [--dry]"
    );
    process.exitCode = 1;
  } else {
    const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
    (command === "all" ? runAll(pool, opts) : runForLeague(pool, command, leagueId, opts))
      .catch((e) => {
        console.error("[wiki-sync] " + e.message);
        process.exitCode = 1;
      })
      .finally(() => pool.end());
  }
}

module.exports = {
  WIKI_MODELS,
  runAll,
  runForLeague,
  runForSeason,
  stageSeasonCast,
  stageSeasonEpisodes,
  stageCachedSeasonEpisodes,
  sameRevisions,
  fetchWikitext,
  findSection,
  listHeadings,
  castSectionCandidates,
  transcludedNames,
  expandTranscludedTables,
  plural,
  singular,
  termsFor,
  validateCast,
  validateEpisodes,
  resolvePhotoUrls,
  normalizePhotoUrl,
  CastSchema,
};
