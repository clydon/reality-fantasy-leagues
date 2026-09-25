// Wiki connector: fetches a season's data from survivor.fandom.com, has Claude extract it into a
// strict schema, validates the result against the league's own state, and files it as a PENDING
// PROPOSAL for the commissioner to confirm. Nothing is ever applied automatically -- see
// docs/PLAN-league-types-and-wiki-connector.md, Feature D.
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
// Every run has two halves, and the split is the load-bearing idea here (db/migrations/0009):
//
//   SEASON-scoped  -- fetch the wiki, ask the model what it says. Identical for every league playing
//                     that season, so it happens once and is cached in `wiki_extractions`, keyed by
//                     (show, season). Cache hits are decided by wiki REVISION ID, not by age: an
//                     unchanged season costs nothing to re-run, a changed one is re-read immediately.
//   LEAGUE-scoped  -- resolve those names against one league's own cast and file the result for
//                     review. No model call, no wiki read; just string matching and an insert.
//
// `episodes` produces one reviewable ITEM per decision (wiki_proposal_items), not one big payload:
// each elimination, scoring event and exile is accepted, rejected or corrected on its own, in the
// Episodes tab. The two halves it reads differ a lot in trustworthiness -- eliminations and exit
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
// Same sender the Next routes use -- plain CommonJS for exactly this reason (see its header).
const { sendPush } = require("../src/lib/server/push-core.js");

const WIKI_API = "https://survivor.fandom.com/api.php";
// Per the claude-api skill's default. Extraction input here is one table (~1-2K tokens) and output
// is ~1K, so a run costs on the order of a cent -- model choice is not the cost lever at this size.
const MODEL = "claude-opus-5";

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

// Exit methods, copied from state-logic.js's EXIT_METHODS. Deliberately a hard enum in the schema
// rather than free text: applyEliminationsImport writes this straight onto castaway.exitMethod, which
// the Episodes UI renders and ScoringLogic reads, so a value outside this list would be a silent
// data-shape break rather than a visible error.
const EXIT_METHODS = [
  "Voted Out",
  "Medically Evacuated",
  "Quit",
  "Lost Fire-Making",
  "Lost Final Tribal (Jury Vote)",
  "Sole Survivor",
  "Other",
];

// Scoring-event types the connector is ALLOWED to suggest. This is ACTIVE_ROSTER_EVENTS minus
// `idolFound`, and the omission is the point: the investigation found idol FINDS appear in neither
// the vote table nor the episode guide (they live in per-episode prose recaps, if anywhere), so the
// connector has no source for them. Leaving the value out of the enum makes it structurally
// impossible for the model to emit one, which is a stronger guarantee than dropping it in validation.
const EVENT_TYPES = ["individualImmunity", "tribeImmunity", "rewardWin", "idolPlayed", "zeroVotesSafe"];

// Per-field confidence, which the plan asks for explicitly: "auto-suggested + high confidence for
// exit method/tribe assignments; auto-suggested + lower confidence ... for immunity/reward winners and
// idol plays/zero-vote safes". Carried through to the review UI so the two aren't reviewed alike.
const EpisodesSchema = z.object({
  mergeEpisode: z
    .number()
    .int()
    .nullable()
    .describe(
      "The episode number from which the cast plays as one merged group, read from the vote table's " +
        "top header row (its columns are grouped into original/shuffled/merged spans). Null if the " +
        "table doesn't show a merge."
    ),
  episodes: z.array(
    z.object({
      number: z.number().int().describe("Episode number as the table numbers it, starting at 1."),
      title: z.string().nullable().describe("Episode title if given, without wiki link markup."),
      airDate: z.string().nullable().describe("Air date exactly as printed, e.g. 'March 1, 2023'. Null if absent."),
      postMerge: z.boolean().describe("True if this episode is at or after mergeEpisode."),
      eliminations: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                "The person's FULL name. The vote table's cells carry it in the image link target " +
                  "(e.g. [[File:...|link=Bruce Perreault]]) even though the visible caption is just " +
                  "the first name -- use the link target when one is present."
              ),
            method: z
              .enum(EXIT_METHODS)
              .describe(
                "How they left, from the Finish column: 'Nth Voted Out' -> Voted Out; 'Evacuated' -> " +
                  "Medically Evacuated; 'Quit' -> Quit; lost a fire-making challenge -> Lost " +
                  "Fire-Making; lost the final jury vote -> Lost Final Tribal (Jury Vote); the winner " +
                  "-> Sole Survivor. Use Other only if none of these fit."
              ),
          })
        )
        .describe(
          "Everyone who left the game PERMANENTLY in this episode, in the order they left. Almost " +
            "always exactly one -- only include more than one if the Finish column explicitly marks " +
            "more than one person as out THIS episode (a rare, explicit double/triple boot). " +
            "Receiving votes is NOT the same as being eliminated: only the person(s) the Finish " +
            "column actually marks as out belong here. Someone who received votes but was saved by " +
            "an idol, a steal-a-vote, or a random-chance advantage (e.g. a 'Shot in the Dark') is " +
            "still active -- do not list them. Do not guess based on vote counts alone."
        ),
      exiled: z
        .array(z.object({ name: z.string().describe("FULL name, same rule as eliminations.") }))
        .describe(
          "Some seasons run an 'Exile Island'-style twist: one or more people are sent away from " +
            "their tribe for this episode (or until a later one) WITHOUT being eliminated -- they " +
            "stay in the game and return to a tribe later. List anyone the text identifies as " +
            "currently exiled/away from their tribe here, NEVER in eliminations. Omit entirely if " +
            "the season has no such twist or none is in effect this episode."
        ),
      events: z
        .array(
          z.object({
            type: z.enum(EVENT_TYPES),
            name: z.string().describe("FULL name, same rule as eliminations."),
            confidence: z
              .enum(["high", "low"])
              .describe(
                "'high' only when the table states this directly and unambiguously. Use 'low' for " +
                  "anything inferred -- whether an immunity win was individual or tribal, anything " +
                  "read via a footnote marker, and any zero-votes-safe you worked out by counting."
              ),
          })
        )
        .describe(
          "Notable things that happened to individuals this episode. tribeImmunity/rewardWin: when a " +
            "TRIBE wins, list every member of it. individualImmunity: post-merge individual wins only. " +
            "idolPlayed: from the footnote marker on a vote cell. zeroVotesSafe: someone who attended " +
            "Tribal Council and received no votes -- count the votes cast in that episode's column. " +
            "Omit an event entirely rather than guessing at it."
        ),
    })
  ),
});

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
// function because the reveal path (fanOutCachedEpisodes) needs the terms from a catalog row
// WITHOUT resolving a season context -- that would fetch the wiki, which a reveal must never do.
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
async function callModel({ system, user, schema, schemaName, maxTokens }) {
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
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens || 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema) },
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
    return { parsed: response.parsed_output, usage: response.usage };
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
async function extractCast(sectionWikitext, terms) {
  const { parsed, usage } = await callModel({
    schema: CastSchema,
    schemaName: "cast",
    system:
      "You extract structured data from MediaWiki wikitext. Report only what the wikitext actually " +
      "states. Never infer, complete or correct a name from outside knowledge of the show -- if a " +
      `field isn't in the text, return null for it. Use each ${terms.castaway}'s ORIGINAL ` +
      `${terms.tribe} (the first ${terms.tribe} column), not a later shuffled or merged one. ` +
      "Some of the text may be tables pulled in from transcluded templates, each marked with an " +
      "HTML comment naming where it came from; treat those as part of the same section. If the " +
      "same person appears in more than one of those tables, return them ONCE.",
    user:
      `Extract every ${terms.castaway} and the starting ${terms.tribes} from this season's ` +
      `${terms.Castaways} section.\n\n` +
      sectionWikitext,
  });
  return { cast: parsed, usage };
}

// Per-episode extraction. Gets BOTH tables in one call because it needs both: who left and how comes
// from the vote table's terminal cells and the guide's Finish column, while immunity and reward wins
// are only in the guide. max_tokens is higher than cast's because the output scales with
// episodes x people -- a full post-merge season runs to roughly a hundred events, most of them
// zero-votes-safes.
async function extractEpisodes(wikitext, terms) {
  const { parsed, usage } = await callModel({
    schema: EpisodesSchema,
    schemaName: "episodes",
    maxTokens: 32000,
    system:
      "You extract structured data from MediaWiki wikitext. Report only what the wikitext actually " +
      "states. Never infer, complete or correct anything from outside knowledge of the show -- if a " +
      "field isn't in the text, return null, and if you cannot tell whether an event happened, omit " +
      "it rather than guessing.\n\n" +
      "The text contains more than one table, each marked with an HTML comment naming the template it " +
      "came from. One is a per-episode guide (air date, reward and immunity winners, who was " +
      "eliminated, their finish). Another is a vote grid with one column per episode and one row per " +
      `${terms.castaway}. They describe the SAME episodes -- combine them, keyed on episode number.\n\n` +
      "These tables use rowspan and colspan heavily, so one cell can belong to several rows or " +
      "columns. Work out which episode each cell belongs to before reporting it.\n\n" +
      "Footnote markers look like {{sup|[[#endnote <anchor>|<n>]]}} and resolve against the " +
      "{{note|<anchor>|<n>}} entries in the Notes block at the bottom of the same table. Match them " +
      "by ANCHOR, never by number: the numbers differ from season to season.\n\n" +
      "The vote grid's per-episode column can carry several DIFFERENT kinds of cell that are easy to " +
      "conflate -- keep them separate: (1) who was voted out this episode -- goes in eliminations, " +
      "and is normally exactly one person; (2) how many votes each attendee received -- a count, not " +
      "an elimination, even for the person with the most votes if someone else was actually voted out " +
      "or if a save changed the result; (3) an advantage played that changed or nullified the result " +
      "(idol, steal-a-vote, a random-chance save like a 'Shot in the Dark') -- the person it saved is " +
      "NOT eliminated even though they were in the vote; (4) someone sent to an 'Exile Island'-style " +
      "twist, away from their tribe but still in the game -- goes in exiled, never in eliminations. " +
      "When in doubt about whether a name belongs in eliminations, leave it out rather than guess.",
    user:
      "Extract the per-episode record for this season: who left each episode and how, and which " +
      "notable things happened to individuals.\n\n" +
      wikitext,
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
function validateEpisodes(extracted, state, terms) {
  const problems = [];
  const fatal = [];
  // Names the wiki used that this league's cast doesn't have. Non-fatal (see resolve below) but
  // surfaced on its own, because a name dropped here is a result that will never be reviewed.
  const unmatched = [];
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
    if (elims.length > 1) {
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

    const evs = [];
    for (const sev of ep.events || []) {
      const c = resolve(sev && sev.name, `episode ${n} ${sev && sev.type}`);
      if (!c) continue;
      // Someone voted out this episode can't also have been safe at that Tribal with no votes. This
      // is the cheapest real check available on the least reliable event type.
      if (sev.type === "zeroVotesSafe" && eliminated.has(c.id)) {
        const msg = `dropped zeroVotesSafe for ${c.name} in episode ${n} -- they were eliminated that episode`;
        problems.push(msg); eventProblems.push(msg);
        continue;
      }
      // individualImmunity is a post-merge concept. Pre-merge, immunity is won by a tribe.
      if (sev.type === "individualImmunity" && !postMerge) {
        const msg = `dropped individualImmunity for ${c.name} in pre-merge episode ${n}`;
        problems.push(msg); eventProblems.push(msg);
        continue;
      }
      const key = `${n}|${sev.type}|${c.id}`;
      if (evs.some((x) => `${n}|${x.type}|${x.castawayKey}` === key)) {
        const msg = `duplicate ${sev.type} for ${c.name} in episode ${n} (kept once)`;
        problems.push(msg); eventProblems.push(msg);
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

  if (!epsOut.length && !eventsOut.length && !unmatched.length) fatal.push("nothing extracted at all");

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
    eliminations: { episodes: epsOut, mergeEpisode: Number.isInteger(merge) ? merge : null, problems: elimProblems },
    scoringEvents: { episodes: eventsOut, mergeEpisode: Number.isInteger(merge) ? merge : null, problems: eventProblems },
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

// What a season page might call the two per-episode tables. Same approach as castSectionCandidates:
// generous synonyms rather than one hardcoded heading, because the Survivor wiki's "Season Summary"
// is the Traitors wiki's "Season Overview". These aren't per-show DB columns (unlike
// shows.cast_section_heading) because nothing has needed one yet -- if a wiki turns up that these
// miss, the column pattern is already established next door.
const VOTE_SECTIONS = ["Voting History", "Vote History", "Voting Table", "Votes", "Voting"];
const GUIDE_SECTIONS = ["Season Summary", "Season Overview", "Episode Guide", "Episode Table", "Episodes", "Summary"];

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
  const provenance = baseProvenance(showSlug, season, page, apiUrl, expanded.pages, { castSection: section.title });

  const reusable = await cachedExtraction(pool, showId, season, "cast", provenance, opts);
  if (reusable) return reusable;

  console.log(
    `[wiki-sync] "${section.title}" section: ${expanded.text.length} chars (rev ${page.revisionId})` +
      (section.matched.toLowerCase() === section.title.toLowerCase() ? "" : ` [matched "${section.matched}"]`)
  );
  const { cast, usage } = await extractCast(expanded.text, terms);
  logUsage(usage);

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
    const { rowCount } = await pool.query(
      `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (season_id, lower(name)) DO NOTHING`,
      [seasonId, c.name, c.tribeName, normalizePhotoUrl(c.photoFile && photos[c.photoFile]), i]
    );
    added += rowCount;
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
  const { page, apiUrl, terms, showSlug, season, showId } = ctx;

  const votes = await sectionWithTables(page, VOTE_SECTIONS, apiUrl);
  const guide = await sectionWithTables(page, GUIDE_SECTIONS, apiUrl);
  if (!votes && !guide) {
    throw new Error(
      sectionNotFound("per-episode", page, [...VOTE_SECTIONS, ...GUIDE_SECTIONS]) +
        "\nThis command needs a voting table, an episode guide, or both."
    );
  }
  // Each half is genuinely optional, but they cover different fields, so say what's missing rather
  // than quietly extracting less: no guide means no immunity or reward wins, no vote grid means no
  // idol plays or zero-vote-safes.
  if (!votes) console.log("[wiki-sync] no voting table found -- idol plays and zero-vote-safes will be missing");
  if (!guide) console.log("[wiki-sync] no episode guide found -- immunity and reward wins will be missing");

  const parts = [];
  if (guide) parts.push(guide.text);
  if (votes) parts.push(votes.text);
  const combined = parts.join("\n\n");
  const readPages = [...(guide ? guide.pages : []), ...(votes ? votes.pages : [])];
  const provenance = baseProvenance(showSlug, season, page, apiUrl, readPages, {
    sections: [guide && guide.title, votes && votes.title].filter(Boolean),
  });

  const reusable = await cachedExtraction(pool, showId, season, "episodes", provenance, opts);
  if (reusable) return reusable;

  console.log(
    `[wiki-sync] sections: ${[guide && guide.title, votes && votes.title].filter(Boolean).join(" + ")} ` +
      `-> ${combined.length} chars across ${readPages.length + 1} page(s)`
  );
  const { episodes, usage } = await extractEpisodes(combined, terms);
  logUsage(usage);
  return storeExtraction(pool, showId, season, "episodes", episodes, provenance, opts);
}

// LEAGUE-scoped half: resolve the season's extraction against THIS league's cast and explode it into
// individual reviewable decisions (see 0009's wiki_proposal_items comment for why per-item).
//
// The three kinds come from two halves of `checked`, which are NOT equally trustworthy -- eliminations
// and exiles are read off stated columns, scoring events are inference over a rowspan-heavy grid and
// footnote markers. That difference now rides on each item's own `confidence` instead of being the
// reason to split into two separate proposals.
async function fanOutEpisodes(pool, extraction, league, terms, opts) {
  const state = league.state;
  // Names resolve against this league's cast, so with no cast there is nothing to resolve and every
  // name would fail. Say that rather than reporting dozens of unmatched names.
  //
  // Which of the two reasons it is matters a lot, and the old message assumed the wrong one. Pulling
  // the cast does NOT put a cast in the league -- it files a proposal a commissioner still has to
  // apply (nothing from the connector is ever applied automatically). So someone who pulls cast and
  // then pulls episodes, in the right order, still lands here, and telling them to "run
  // `node db/wiki-sync.js cast <id>`" sends them to re-do the step they already did, by a route that
  // isn't even the one they used. Look at whether a cast proposal is already waiting, and name the
  // actual next click.
  if (!state.castaways.length) {
    const { rows: waiting } = await pool.query(
      "SELECT 1 FROM wiki_proposals WHERE league_id=$1 AND kind='cast' AND status='pending' LIMIT 1",
      [league.id]
    );
    throw new Error(
      waiting.length
        ? `no ${terms.castaways} in this league yet -- its cast import is filed but NOT applied. ` +
            `A commissioner opens League Settings > Wiki Connector in "${league.name}" and clicks Apply on the ` +
            `pending cast proposal; pulling episodes works from then on. (The connector never applies anything itself.)`
        : `no ${terms.castaways} in this league yet, and no cast proposal is waiting either -- pull the cast for ` +
            `this season first, then apply it in "${league.name}"'s League Settings > Wiki Connector.`
    );
  }

  const checked = validateEpisodes(extraction.payload, state, terms);
  checked.problems.forEach((p) => console.log(`[wiki-sync]   note (${league.name}): ${p}`));
  if (checked.fatal.length) {
    throw new Error(`failed validation, nothing filed:\n    - ${checked.fatal.join("\n    - ")}`);
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

  // CATCH-UP GATE (StateLogic.RevealLogic). A league that started mid-season can be deliberately
  // behind the wiki: it may see episodes 1..n and nothing past that. Filtering here, before anything
  // is written, is what keeps the rest of the app honest -- an item that never lands in the table
  // can't show up on an episode card, can't be accepted by accident, and can't trigger the "results
  // ready to review" push, which would name an episode the league hasn't reached. Live leagues
  // (pointer null, which is every league that predates this) filter nothing.
  //
  // The SEASON half of the run above is untouched: the extraction is still read and cached once for
  // everyone, so a caught-up league and a live league on the same season still cost one model call
  // between them. Raising the pointer later re-runs this fan-out against that same cache -- see
  // fanOutCachedEpisodes.
  const gate = StateLogic.RevealLogic.revealedThrough(state);
  const held = gate === null ? [] : items.filter((it) => it.episode > gate);
  const visible = gate === null ? items : items.filter((it) => it.episode <= gate);

  // Named in the summary rather than buried in the console: these are results the league will never
  // see unless someone fixes the cast. The commissioner's own panel shows this string.
  const unmatchedNames = checked.unmatched
    .map((u) => (u.match(/^"([^"]+)"/) || [])[1])
    .filter(Boolean)
    .filter((name, i, all) => all.indexOf(name) === i);
  const unmatchedNote = unmatchedNames.length
    ? ` — ${unmatchedNames.length} couldn't be matched to anyone in your cast: ${unmatchedNames.join(", ")}`
    : "";

  const c = checked.counts;
  const counts =
    `${items.length} decisions across ${c.episodes} episodes ` +
    `(${c.eliminations} eliminations, ${c.newEliminations} new; ${c.events} events, ${c.lowConfidence} low-confidence)` +
    (held.length ? `; ${held.length} held back past revealed episode ${gate}` : "") +
    unmatchedNote;
  console.log(`[wiki-sync]   ${league.name}: ${counts}`);
  if (opts.dry) {
    console.log(`[wiki-sync]   --dry: would write ${visible.length} items for ${league.name}`);
    return { filed: false, summary: `${counts} — dry run, nothing written`, unmatched: unmatchedNames, written: 0 };
  }
  if (!visible.length) return { filed: false, summary: `${counts} — nothing to write`, unmatched: unmatchedNames, written: 0 };

  // All of one league's items in one transaction: a fan-out that dies halfway through shouldn't
  // leave a commissioner reviewing half an episode.
  const client = await pool.connect();
  let touched = 0;
  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const it of visible) {
      // Leaves an already-accepted/rejected row completely alone (the WHERE) -- re-running must never
      // resurrect a decision the commissioner already made. See 0009's identity-index comment.
      //
      // RETURNING (xmax = 0) tells a fresh INSERT apart from an UPDATE of a still-pending row: only
      // brand-new decisions should trigger a "results ready to review" push, or every nightly run
      // would re-send it for as long as anything sat unreviewed.
      const { rowCount, rows } = await client.query(
        `INSERT INTO wiki_proposal_items
           (league_id, extraction_id, episode_number, post_merge, kind, castaway_name, method, event_type, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (league_id, episode_number, kind, castaway_name, event_type)
         DO UPDATE SET method = EXCLUDED.method,
                       confidence = EXCLUDED.confidence,
                       post_merge = EXCLUDED.post_merge,
                       extraction_id = EXCLUDED.extraction_id,
                       created_at = now()
         WHERE wiki_proposal_items.status = 'pending'
         RETURNING (xmax = 0) AS inserted`,
        [league.id, extraction.id, it.episode, it.postMerge, it.kind, it.name, it.method, it.eventType, it.confidence]
      );
      touched += rowCount;
      if (rows[0] && rows[0].inserted) inserted++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const written =
    `${touched} pending item(s) written (${inserted} new)` +
    (visible.length - touched ? `, ${visible.length - touched} already decided and left alone` : "");
  console.log(`[wiki-sync]   ${league.name}: ${written}`);
  // opts.silent: a commissioner who just clicked "Reveal episode 4" does not need a push telling
  // them episode 4's results are ready -- they're looking at the page that shows them.
  if (inserted && !opts.silent) await notifyCommissionersOfReview(pool, league, inserted);
  return { filed: touched > 0, summary: `${counts} — ${written}`, unmatched: unmatchedNames, written: touched };
}

// Push the league's commissioners when the sync filed decisions they haven't seen before. Awaited
// (this is a script, not a request -- nothing to return early to), and sendPush never throws.
async function notifyCommissionersOfReview(pool, league, count) {
  const { rows } = await pool.query(
    "SELECT user_id FROM league_memberships WHERE league_id=$1 AND role='commissioner'",
    [league.id]
  );
  const result = await sendPush(
    pool,
    rows.map((r) => r.user_id),
    "wikiReview",
    {
      title: "Episode results ready to review",
      body: `${count} new result${count === 1 ? "" : "s"} for ${league.name} came in from the wiki.`,
      url: `/episodes?league=${encodeURIComponent(league.id)}`,
      tag: `wiki-review-${league.id}`,
    }
  );
  if (result.sent) console.log(`[wiki-sync]   ${league.name}: notified commissioner device(s): ${result.sent}`);
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
    model: MODEL,
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
// Only episodes fan out to leagues. The cast is staged once per season for admin review instead --
// see stageSeasonCast for why that difference is the right shape rather than an inconsistency.
const FANOUTS = { episodes: fanOutEpisodes };

// Everything needed to read one season, derived from the catalog rather than from any league --
// which is the whole reason this is its own function now. Two leagues on the same season resolve to
// byte-identical context, so the read below them can be shared.
async function resolveSeasonContext(pool, showSlug, season, label) {
  // The admin-managed catalog (db/migrations/0006_shows_and_seasons.sql): the season row carries the
  // wiki page title an admin entered, and the show row the API endpoint for that show's wiki --
  // which is the point, since different shows live on different wikis.
  const { rows: catalog } = await pool.query(
    `SELECT s.id AS show_id, ss.wiki_page_title, ss.name AS season_name,
            s.name AS show_name, s.wiki_api_url, s.castaway_term, s.tribe_term, s.cast_section_heading
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
  return { showId: entry.show_id, showSlug, season, entry, page, apiUrl, terms, castawayTerm, tribeTerm };
}

function leagueSeasonOf(league) {
  const settings = (league.state && league.state.settings) || {};
  return { showSlug: settings.showId, season: settings.wikiSeason };
}

// One league, one kind -- the shape the CLI has always had. Now just a thin wrapper: extract for the
// season (cache-aware), then fan out to this one league.
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
  else await FANOUTS[command](pool, extraction, league, ctx.terms, opts);
}

// The reveal path: fan out ONE league's episode decisions from the extraction already cached for
// its season (db/migrations/0009's wiki_extractions), with no wiki read and no model call.
//
// This is what POST /api/leagues/:id/reveal-next calls after raising the league's reveal pointer.
// Re-running the fan-out is all a reveal has to do, because the gate lives in fanOutEpisodes: the
// same cached payload that filed episodes 1-3 last time files 1-4 now, and the identity index on
// wiki_proposal_items means the three it already wrote are left exactly as they are (accepted ones
// stay accepted, rejected ones stay rejected -- see that migration's comment).
//
// Returns null when there's nothing cached for the season yet, which is a real and unremarkable
// state: the wiki hasn't been read since that episode aired. The reveal still counts; the next sync
// fills it in.
async function fanOutCachedEpisodes(pool, league, opts = {}) {
  const { showSlug, season } = leagueSeasonOf(league);
  if (!showSlug || !season) return null;

  const { rows } = await pool.query(
    `SELECT s.id AS show_id, s.castaway_term, s.tribe_term
       FROM shows s WHERE s.slug = $1`,
    [showSlug]
  );
  if (!rows.length) return null;
  const { terms } = termsFor(rows[0]);

  const { rows: cached } = await pool.query(
    "SELECT id, payload, provenance FROM wiki_extractions WHERE show_id=$1 AND season_number=$2 AND kind='episodes'",
    [rows[0].show_id, season]
  );
  if (!cached.length) return null;

  // silent by default: the person who triggered this is looking at the page that shows the result.
  return fanOutEpisodes(pool, { ...cached[0], cached: true }, league, terms, { silent: true, ...opts });
}

// One SEASON, one kind -- what the admin catalog's per-season "Pull cast"/"Pull episodes" buttons
// call (POST /api/admin/seasons/:id/sync). This is `all` narrowed to a single season rather than
// `runForLeague` widened: the catalog row an admin clicks IS a (show, season), and the expensive
// half of the work is already season-scoped, so the natural unit here is the season -- extract once,
// then fan out to every league tracking it, however many that is (including none, which still
// primes the extraction cache).
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
  };

  // The cast doesn't fan out. It's staged once for the season and reviewed by an admin (see
  // stageSeasonCast); approving it is what reaches the leagues. Only episode results are per-league.
  if (kind === "cast") {
    const staged = await stageSeasonCast(pool, ctx, extraction, opts);
    return { kind, showSlug, season, ...provenance, staged, leagues: [] };
  }

  // wikiSeason is a JSON number, so `->>` gives its digits; compared as text rather than cast to int
  // because a single league with a non-numeric value there would make the cast error out for all of
  // them -- see the same query shape in runAll's WHERE.
  const { rows: leagues } = await pool.query(
    `SELECT id, name, state FROM leagues
      WHERE state->'settings'->>'showId' = $1
        AND state->'settings'->>'wikiSeason' = $2
      ORDER BY name`,
    [showSlug, String(season)]
  );

  const results = [];
  for (const league of leagues) {
    try {
      const out = await FANOUTS[kind](pool, extraction, league, ctx.terms, opts);
      results.push({ id: league.id, name: league.name, ok: true, summary: (out && out.summary) || "done" });
    } catch (e) {
      console.error(`[wiki-sync]   ${league.name} (${kind}): ${e.message}`);
      results.push({ id: league.id, name: league.name, ok: false, error: e.message });
    }
  }
  return { kind, showSlug, season, ...provenance, staged: null, leagues: results };
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
      // The cast is season data: staged once for review, never fanned out. See stageSeasonCast.
      if (kind === "cast") {
        try {
          await stageSeasonCast(pool, ctx, extraction, opts);
        } catch (e) {
          console.error(`[wiki-sync] ${showSlug} season ${season} cast: ${e.message}`);
          failures++;
        }
        continue;
      }
      for (const league of members) {
        try {
          await FANOUTS[kind](pool, extraction, league, ctx.terms, { ...opts, batch: true });
        } catch (e) {
          // One league's cast being empty, or its names not matching, must not deny the other nine
          // leagues on this season a result they'd have got fine.
          console.error(`[wiki-sync]   ${league.name} (${kind}): ${e.message}`);
          failures++;
        }
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
  runAll,
  runForLeague,
  runForSeason,
  fanOutCachedEpisodes,
  stageSeasonCast,
  fanOutEpisodes,
  sameRevisions,
  fetchWikitext,
  findSection,
  listHeadings,
  castSectionCandidates,
  transcludedNames,
  expandTranscludedTables,
  plural,
  singular,
  validateCast,
  validateEpisodes,
  resolvePhotoUrls,
  normalizePhotoUrl,
  CastSchema,
  EpisodesSchema,
  EXIT_METHODS,
  EVENT_TYPES,
  VOTE_SECTIONS,
  GUIDE_SECTIONS,
};
