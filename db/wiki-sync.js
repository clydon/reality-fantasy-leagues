// Wiki connector: fetches a season's data from survivor.fandom.com, has Claude extract it into a
// strict schema, validates the result against the league's own state, and files it as a PENDING
// PROPOSAL for the commissioner to confirm. Nothing is ever applied automatically -- see
// docs/PLAN-league-types-and-wiki-connector.md, Feature D.
//
// Standalone CLI, same shape as db/migrate.js and db/seed-dev-admin.js (plain CommonJS, run with
// `node db/...`, not part of the Next.js bundle). The Next app has no persistent server process, so
// recurring runs are scheduled externally -- Windows Task Scheduler locally.
//
//   node db/wiki-sync.js cast <leagueId>          # import the cast list for the league's season
//   node db/wiki-sync.js cast <leagueId> --dry    # extract and print, write nothing
//
// The league's season comes from settings.wikiSeason; this refuses to run rather than guess it.
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
      out[page.title.replace(/^File:/, "")] = page.imageinfo[0].url;
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
async function extractCast(sectionWikitext, terms) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error(
      "No Anthropic credentials found. Set ANTHROPIC_API_KEY in .env.local (or run `ant auth login`).\n" +
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
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system:
        "You extract structured data from MediaWiki wikitext. Report only what the wikitext actually " +
        "states. Never infer, complete or correct a name from outside knowledge of the show -- if a " +
        `field isn't in the text, return null for it. Use each ${terms.castaway}'s ORIGINAL ` +
        `${terms.tribe} (the first ${terms.tribe} column), not a later shuffled or merged one. ` +
        "Some of the text may be tables pulled in from transcluded templates, each marked with an " +
        "HTML comment naming where it came from; treat those as part of the same section. If the " +
        "same person appears in more than one of those tables, return them ONCE.",
      messages: [
        {
          role: "user",
          content:
            `Extract every ${terms.castaway} and the starting ${terms.tribes} from this season's ` +
            `${terms.Castaways} section.\n\n` +
            sectionWikitext,
        },
      ],
      output_config: { format: zodOutputFormat(CastSchema) },
    });
    // parsed_output is null when the response couldn't be parsed into the schema.
    if (!response.parsed_output) {
      throw new Error("Claude returned a response that did not match the cast schema.");
    }
    return { cast: response.parsed_output, usage: response.usage };
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

// ---------- main ----------
async function run(pool, command, leagueId, opts) {
  if (command !== "cast") {
    throw new Error(`Unknown command "${command}". Supported: cast`);
  }
  const { rows } = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new Error(`No league with id ${leagueId}`);
  const league = rows[0];
  const state = league.state;
  const season = state.settings && state.settings.wikiSeason;
  if (!season) {
    throw new Error(
      `League "${league.name}" has no wikiSeason set. Set it in League Settings first -- this won't guess which season you mean.`
    );
  }

  // Resolve the page from the admin-managed catalog (db/migrations/0006_shows_and_seasons.sql):
  // the season row carries the wiki page title an admin entered, and the show row the API endpoint
  // for that show's wiki -- which is the point, since different shows live on different wikis.
  //
  // Falls back to the old hardcoded shape when there's no catalog row, so a league set up before the
  // catalog existed (or one whose season row was deleted) still works rather than hard-failing.
  const showSlug = state.settings && state.settings.showId;
  if (!showSlug) {
    throw new Error(
      `League "${league.name}" has no show set. Pick one in League Settings first -- this used to ` +
        `assume Survivor, which is exactly how a Traitors league ends up fetching the wrong wiki.`
    );
  }
  const { rows: catalog } = await pool.query(
    `SELECT ss.wiki_page_title, ss.name AS season_name,
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
      `League "${league.name}" points at show "${showSlug}", which isn't in the catalog. ` +
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
  // extraction prompt. Normalized to singular so a term entered either way yields the same forms.
  const castawayTerm = singular((entry.castaway_term || "Castaway").trim());
  const tribeTerm = singular((entry.tribe_term || "Tribe").trim());
  const terms = {
    Castaway: castawayTerm,
    Castaways: plural(castawayTerm),
    castaway: castawayTerm.toLowerCase(),
    castaways: plural(castawayTerm).toLowerCase(),
    Tribe: tribeTerm,
    Tribes: plural(tribeTerm),
    tribe: tribeTerm.toLowerCase(),
    tribes: plural(tribeTerm).toLowerCase(),
  };
  if (!entry.wiki_page_title) {
    console.log(
      `[wiki-sync] no catalog page title for ${showSlug} season ${season} -- guessing "${pageTitle}". ` +
        `Add the season's wiki URL in Admin > Shows & Seasons to make this exact.`
    );
  }
  console.log(`[wiki-sync] league "${league.name}" -> ${pageTitle} (${apiUrl})`);
  const page = await fetchWikitext(pageTitle, apiUrl);

  // Which heading holds the cast is a per-show question, not a constant. See castSectionCandidates:
  // the show's own castaway_term drives the guess, with shows.cast_section_heading as the override.
  const candidates = castSectionCandidates(castawayTerm, entry.cast_section_heading);
  const section = findSection(page.wikitext, candidates);
  if (!section) {
    // Name what was looked for AND what the page actually has. The old message said only
    // `No ==Castaways== section found`, which gave an admin no way to tell whether the page was
    // wrong, the heading was spelled differently, or the wiki uses another word entirely.
    const found = listHeadings(page.wikitext).map((h) => h.title);
    throw new Error(
      `No cast section found on "${page.title}".
` +
        `  looked for: ${candidates.join(", ")}
` +
        `  page has:   ${found.length ? found.join(", ") : "(no headings at all)"}
` +
        `Set the right one as the Cast section in Admin > Shows & Seasons.`
    );
  }
  const expanded = await expandTranscludedTables(section.text, apiUrl);
  console.log(
    `[wiki-sync] "${section.title}" section: ${expanded.text.length} chars (rev ${page.revisionId})` +
      (section.matched.toLowerCase() === section.title.toLowerCase() ? "" : ` [matched "${section.matched}"]`)
  );

  const { cast, usage } = await extractCast(expanded.text, terms);
  const checked = validateCast(cast, state, terms);
  checked.problems.forEach((p) => console.log(`[wiki-sync] note: ${p}`));
  if (checked.fatal.length) {
    throw new Error(`Extraction failed validation, nothing filed:\n  - ${checked.fatal.join("\n  - ")}`);
  }

  // Same wiki as the page itself -- the File: names only resolve against their own wiki.
  const photos = await resolvePhotoUrls(checked.castaways.map((c) => c.photoFile), apiUrl);
  const payload = {
    tribes: checked.tribes,
    castaways: checked.castaways.map((c) => ({
      name: c.name,
      tribeName: c.tribeName,
      photoUrl: (c.photoFile && photos[c.photoFile]) || null,
    })),
  };
  const withPhotos = payload.castaways.filter((c) => c.photoUrl).length;
  console.log(
    `[wiki-sync] extracted ${payload.castaways.length} ${terms.castaways} (${checked.newCount} new to this ` +
      `league), ${payload.tribes.length} ${terms.tribes}, ${withPhotos} photos resolved`
  );
  if (usage) console.log(`[wiki-sync] tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`);

  if (opts.dry) {
    console.log("[wiki-sync] --dry: not filing a proposal");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const provenance = {
    // Which show, not just which season: with a multi-show catalog, "season 44" alone no longer
    // identifies what was read.
    showSlug,
    seasonNumber: season,
    model: MODEL,
    extractedAt: new Date().toISOString(),
    // Every page the extraction actually read, season page first -- transcluded templates included,
    // since with transclusion the season page's own revision id no longer pins what was extracted.
    pages: [{ title: page.title, revisionId: page.revisionId, apiUrl }, ...expanded.pages],
    castSection: section.title,
  };
  // One pending proposal per league per kind (partial unique index), so a second scheduled run before
  // anyone reviews replaces its own earlier suggestion instead of queueing a duplicate.
  await pool.query(
    `INSERT INTO wiki_proposals (league_id, kind, payload, provenance)
     VALUES ($1,'cast',$2::jsonb,$3::jsonb)
     ON CONFLICT (league_id, kind) WHERE status='pending'
     DO UPDATE SET payload=EXCLUDED.payload, provenance=EXCLUDED.provenance, created_at=now()`,
    [leagueId, JSON.stringify(payload), JSON.stringify(provenance)]
  );
  console.log("[wiki-sync] filed a pending proposal -- review it in League Settings.");
}

if (require.main === module) {
  const [command, leagueId, ...flags] = process.argv.slice(2);
  if (!command || !leagueId) {
    console.error("usage: node db/wiki-sync.js cast <leagueId> [--dry]");
    process.exitCode = 1;
  } else {
    const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
    run(pool, command, leagueId, { dry: flags.includes("--dry") })
      .catch((e) => {
        console.error("[wiki-sync] " + e.message);
        process.exitCode = 1;
      })
      .finally(() => pool.end());
  }
}

module.exports = {
  fetchWikitext,
  findSection,
  listHeadings,
  castSectionCandidates,
  transcludedNames,
  expandTranscludedTables,
  plural,
  singular,
  validateCast,
  resolvePhotoUrls,
  CastSchema,
};
