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
    .describe("The season's starting tribes, in the order the table presents them."),
  castaways: z.array(
    z.object({
      name: z.string().describe("Full name as the wiki gives it, e.g. 'Bruce Perreault'."),
      tribeName: z
        .string()
        .nullable()
        .describe("The castaway's ORIGINAL tribe name, or null if the table doesn't give one."),
      photoFile: z
        .string()
        .nullable()
        .describe("The File: name from the row, e.g. 'S44 bruce t.png', without the 'File:' prefix. Null if absent."),
    })
  ),
});

// ---------- MediaWiki ----------
async function fetchWikitext(title) {
  const url =
    `${WIKI_API}?action=query&prop=revisions&titles=${encodeURIComponent(title)}` +
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
async function resolvePhotoUrls(fileNames) {
  const wanted = fileNames.filter(Boolean).slice(0, 50); // API caps titles per request
  if (!wanted.length) return {};
  const titles = wanted.map((f) => "File:" + f).join("|");
  const url =
    `${WIKI_API}?action=query&titles=${encodeURIComponent(titles)}` +
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

// The cast table is one section of a long page. Slicing to it before the model sees it keeps the
// extraction focused and the token count small -- and it's a deterministic cut, so it can't drop a
// row the way asking the model to "find the castaways section" might.
function sliceSection(wikitext, heading) {
  const start = wikitext.indexOf(heading);
  if (start < 0) return null;
  const rest = wikitext.slice(start + heading.length);
  const nextHeading = rest.search(/\n==[^=]/);
  return heading + (nextHeading < 0 ? rest : rest.slice(0, nextHeading));
}

// ---------- extraction ----------
async function extractCast(sectionWikitext) {
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
        "field isn't in the text, return null for it. Use each castaway's ORIGINAL tribe (the first " +
        "tribe column), not a later shuffled or merged tribe.",
      messages: [
        {
          role: "user",
          content:
            "Extract every castaway and the starting tribes from this season's Castaways table.\n\n" +
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
function validateCast(cast, state) {
  const problems = [];
  const tribeNames = (cast.tribes || []).map((t) => (t.name || "").trim()).filter(Boolean);
  if (!tribeNames.length) problems.push("no tribes extracted");
  if (new Set(tribeNames.map((n) => n.toLowerCase())).size !== tribeNames.length) {
    problems.push("duplicate tribe names");
  }

  const seen = new Set();
  const castaways = [];
  for (const c of cast.castaways || []) {
    const name = (c.name || "").trim();
    if (!name) { problems.push("a castaway row had no name"); continue; }
    // Wiki names are people's names -- anything wild here means the extraction went off the rails.
    if (name.length > 60) { problems.push(`implausible castaway name: "${name.slice(0, 40)}..."`); continue; }
    const key = name.toLowerCase();
    if (seen.has(key)) { problems.push(`duplicate castaway: ${name}`); continue; }
    seen.add(key);

    let tribeName = c.tribeName ? String(c.tribeName).trim() : null;
    // A tribe the model named but the tribe list doesn't contain is exactly the kind of quiet
    // invention worth dropping: keep the castaway, drop the unbacked tribe link.
    if (tribeName && !tribeNames.some((t) => t.toLowerCase() === tribeName.toLowerCase())) {
      problems.push(`castaway "${name}" referenced unknown tribe "${tribeName}" (tribe link dropped)`);
      tribeName = null;
    }
    castaways.push({ name, tribeName, photoFile: c.photoFile ? String(c.photoFile).trim() : null });
  }

  if (castaways.length < 4) problems.push(`only ${castaways.length} castaways extracted -- too few to be a real season`);
  if (castaways.length > 40) problems.push(`${castaways.length} castaways extracted -- more than any real season`);

  // How much of this is actually new is the commissioner's main question, so compute it here rather
  // than making them diff two lists by eye.
  const existing = new Set(state.castaways.map((c) => c.name.trim().toLowerCase()));
  const newCastaways = castaways.filter((c) => !existing.has(c.name.toLowerCase()));

  // A dropped tribe link is a note, not a reason to refuse the whole run. Anything structural is.
  const fatal = problems.filter((p) => !p.includes("tribe link dropped"));
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

  const pageTitle = `Survivor ${season}`;
  console.log(`[wiki-sync] league "${league.name}" -> ${pageTitle}`);
  const page = await fetchWikitext(pageTitle);
  const section = sliceSection(page.wikitext, "==Castaways==");
  if (!section) throw new Error(`No ==Castaways== section found on "${page.title}"`);
  console.log(`[wiki-sync] castaways section: ${section.length} chars (rev ${page.revisionId})`);

  const { cast, usage } = await extractCast(section);
  const checked = validateCast(cast, state);
  checked.problems.forEach((p) => console.log(`[wiki-sync] note: ${p}`));
  if (checked.fatal.length) {
    throw new Error(`Extraction failed validation, nothing filed:\n  - ${checked.fatal.join("\n  - ")}`);
  }

  const photos = await resolvePhotoUrls(checked.castaways.map((c) => c.photoFile));
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
    `[wiki-sync] extracted ${payload.castaways.length} castaways (${checked.newCount} new to this league), ` +
      `${payload.tribes.length} tribes, ${withPhotos} photos resolved`
  );
  if (usage) console.log(`[wiki-sync] tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`);

  if (opts.dry) {
    console.log("[wiki-sync] --dry: not filing a proposal");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const provenance = {
    seasonNumber: season,
    model: MODEL,
    extractedAt: new Date().toISOString(),
    pages: [{ title: page.title, revisionId: page.revisionId }],
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

module.exports = { fetchWikitext, sliceSection, validateCast, resolvePhotoUrls, CastSchema };
