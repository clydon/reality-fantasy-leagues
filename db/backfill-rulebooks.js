// Fills the rulebooks tables from today's rules (docs/PLAN-rulebooks-implementation.md 5.2, docs/PLAN-new-design.md
// step R3). Run once per environment after migration 0107, and again whenever: it's idempotent, so a second run makes
// only what's missing and brings an unedited rulebook up to a source that moved.
//
//   node db/backfill-rulebooks.js             make and refresh, print the report
//   node db/backfill-rulebooks.js --dry-run   the same in a transaction that's rolled back: writes nothing
//
// The database is RULEBOOKS_DATABASE_URL if set (a Neon branch: scripts/rehearse-migrations.js passes it), else
// AUTH_DATABASE_URL (.env.local). It prints the host.
//
//   1. The library. A template per built-in format (survivor, traitors, challenge, generic) and per approved stored
//      format: its blocks (the hand-written ones, or read back from its data), its data as both `compiled` and
//      `base` (compiled_source 'legacy', the legacy freeze). And each researched rulebook in
//      src/lib/game/formats/library/ as a draft for review.
//   2. A rulebook per season: a copy of its show's format's template, plus the phase starts its accepted results
//      confirm (Survivor's merge), and show_seasons.rulebook_id. Each is checked: its compiled data must be exactly
//      the format the season's research reads today. A show whose format couldn't be resolved (a draft, or gone)
//      plays by Survivor's, as its leagues do, and is reported.
//   3. Each approved (or since withdrawn) season rule change as a rulebook_edits row on its season's rulebook
//      (source 'migration', legacy_id the change), its delta translated to ops where the blocks can say it and kept
//      whole in `proposal`. A copy for phase 5: season_rule_changes is still what research applies.
//   4. A league rulebook for each league on its own ruleset copy, leagues.rulebook_id set.
//
// It writes nothing into any league's state: with the rulebooks flag on, syncLeagueRulebook does that
// (scripts/rulebooks-flag.js). Plain CommonJS; db/rulebooks.js does the work, so the app's lazy paths make the same
// rows this does.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Formats = require("../src/lib/game/formats/index.js");
const { camelId } = require("../src/lib/game/formats/rulebook-schema.js");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");
const ShowFormats = require("./show-formats.js");
const R = require("./rulebooks.js");

// Any constant every runner agrees on, so two backfills can't interleave (db/migrate.js does the same).
const BACKFILL_LOCK = 8145724;

/**
 * A season rule change's delta (formats/season-changes.js) as rulebook ops (plan 4.4), best effort: a new event
 * research asks about is a hand-added moment with its points, a new exit method a way out, a retired event a moment
 * switched off (through `aliases.events` back to the moment). What blocks can't say (an event implied by an exit,
 * exile or role; a category) is listed in `untranslated`; the delta itself goes into the edit's proposal.
 */
function opsFromDelta(delta, aliases = {}) {
  const d = delta || {};
  const ops = [];
  const untranslated = [];
  const research = (d.addRules && d.addRules.research) || [];
  const questions = d.addQuestions || [];
  for (const e of d.addEvents || []) {
    if (e.implied) {
      untranslated.push(`event ${e.id} (implied)`);
      continue;
    }
    const rule = research.find((r) => r.award === e.id);
    const q = rule && rule.when && questions.find((x) => x.key === rule.when.answer);
    ops.push({
      op: "add", block: "customMoments",
      value: { id: e.id, label: e.label, ...(q && q.description ? { question: q.description } : {}), counted: "yesNo", answeredBy: "research", reliability: "usually" },
    });
    ops.push({ op: "add", block: "points", id: e.id, value: e.defaultPoints });
  }
  for (const m of d.addExitMethods || []) {
    ops.push({ op: "add", block: "waysOut", value: { id: camelId(m.name), name: m.name, means: m.endgame ? "finalist" : "out", cause: "story" } });
  }
  const momentOf = (eventId) => Object.keys(aliases.events || {}).find((m) => aliases.events[m] === eventId) || eventId;
  for (const id of d.retireEvents || []) ops.push({ op: "add", block: "momentsOff", id: momentOf(id) });
  for (const c of d.addCategories || []) untranslated.push(`category ${c.id}`);
  return { ops, untranslated };
}

async function copyChanges(db, report) {
  const { rows } = await db.query(
    `SELECT c.*, ss.rulebook_id FROM season_rule_changes c JOIN show_seasons ss ON ss.id = c.season_id
      WHERE c.status IN ('approved', 'withdrawn') AND ss.rulebook_id IS NOT NULL ORDER BY c.effective_episode, c.approved_at`
  );
  for (const c of rows) {
    const book = await R.getRulebook(db, c.rulebook_id);
    const { ops, untranslated } = opsFromDelta(c.delta, book.aliases);
    const fields = [
      c.rulebook_id, "show_changed", c.effective_episode, c.status === "approved" ? "in_force" : "withdrawn", JSON.stringify(ops), c.summary,
      JSON.stringify({ delta: c.delta, untranslated, change: { id: c.id, version: c.version } }), c.checked_through, book.version, c.id,
      c.approved_by, c.approved_at,
    ];
    const { rows: made } = await db.query(
      `INSERT INTO rulebook_edits (rulebook_id, kind, from_episode, status, ops, summary, source, proposal, checked_through, base_version, legacy_id, approved_by, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,'migration',$7,$8,$9,$10,$11,$12)
       ON CONFLICT (legacy_id) DO UPDATE SET status=EXCLUDED.status, ops=EXCLUDED.ops, summary=EXCLUDED.summary, proposal=EXCLUDED.proposal,
              from_episode=EXCLUDED.from_episode, updated_at=now()
        WHERE (rulebook_edits.status, rulebook_edits.ops, rulebook_edits.proposal, rulebook_edits.from_episode)
              IS DISTINCT FROM (EXCLUDED.status, EXCLUDED.ops, EXCLUDED.proposal, EXCLUDED.from_episode)
       RETURNING (xmax = 0) AS created`,
      fields
    );
    report.count("edits", made.length ? (made[0].created ? "created" : "updated") : "unchanged");
    if (untranslated.length) report.notes.push(`season change ${c.id}: kept whole, not as ops: ${untranslated.join(", ")}`);
  }
}

function newReport() {
  const counts = {};
  return {
    counts,
    checks: [],
    notes: [],
    count(kind, change) {
      counts[kind] = counts[kind] || { created: 0, updated: 0, unchanged: 0, archived: 0 };
      counts[kind][change] += 1;
    },
  };
}

/** The whole backfill on `db` (a client inside the caller's transaction). Returns the report. */
async function backfill(db) {
  const report = newReport();
  // 1. The library.
  for (const id of Object.keys(Formats.FORMATS)) {
    report.count("templates", (await R.ensureTemplate(db, await R.sourceFor(db, id))).change);
  }
  const { rows: stored } = await db.query("SELECT id FROM show_formats WHERE status='approved' AND data IS NOT NULL ORDER BY id");
  for (const f of stored) {
    const source = await R.sourceFor(db, f.id);
    // A show someone made a game: its rules are its seasons' rulebooks, never a template (step 10 part 3).
    if ((await R.madeFormat(db, f.id)) !== null) continue;
    if (source.kind !== "show_format") {
      report.notes.push(`stored format ${f.id} doesn't resolve as itself (its data's id isn't "${f.id}"), so it has no template`);
      continue;
    }
    report.count("templates", (await R.ensureTemplate(db, source)).change);
  }
  for (const entry of Object.values(LIBRARY)) report.count("library", (await R.ensureLibraryEntry(db, entry)).change);

  // 2. Seasons, each checked against what its research reads today.
  const { rows: seasons } = await db.query(
    `SELECT ss.id, ss.season_number, s.slug, s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id ORDER BY s.slug, ss.season_number`
  );
  for (const ss of seasons) {
    const { row, change, source } = await R.ensureSeasonRulebook(db, ss.id);
    report.count("seasons", change);
    const today = await ShowFormats.resolveFormat(db, ss.format);
    const same = R.sameData(row.compiled, today.data) && row.reader === R.readerOf(today);
    report.checks.push({ season: `${ss.slug} ${ss.season_number}`, rulebook: row.id, version: row.version, reader: row.reader, phaseStarts: row.phaseStarts, same });
    const open = ((row.blocks.season && row.blocks.season.phases) || []).filter((p) => !(p.starts && p.starts.type === "episode") && row.phaseStarts[p.id] == null);
    if (open.length) report.notes.push(`${ss.slug} ${ss.season_number}: when ${open.map((p) => p.name).join(", ")} began isn't confirmed yet (for a person to set, step 6b)`);
    if (source.fellBack) report.notes.push(`${ss.slug}: its format "${ss.format}" isn't a built-in or an approved stored format, so it plays by Survivor's (as its leagues do)`);
  }

  // 3. Season rule changes, as edits.
  await copyChanges(db, report);

  // 4. Leagues on their own copy.
  const { rows: leagues } = await db.query(
    `SELECT id, slug, state->'settings' AS settings FROM leagues WHERE ruleset_id IS NOT NULL OR rulebook_id IS NOT NULL ORDER BY created_at`
  );
  for (const l of leagues) {
    const seasonId = await R.seasonIdOf(db, l.settings);
    const parent = seasonId ? await R.seasonRulebook(db, seasonId) : null;
    report.count("leagues", (await R.ensureLeagueRulebook(db, l.id, l.settings || {}, { parent })).change);
  }
  return report;
}

function print(report, { dryRun }) {
  console.log(`[rulebooks] ${dryRun ? "dry run, nothing written" : "backfilled"}`);
  for (const [kind, c] of Object.entries(report.counts)) {
    const parts = Object.entries(c).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`);
    console.log(`  ${kind}: ${parts.join(", ") || "none"}`);
  }
  console.log("  seasons, each rulebook against the format its research reads today:");
  for (const c of report.checks) {
    const starts = Object.keys(c.phaseStarts || {}).length ? ` phase starts ${JSON.stringify(c.phaseStarts)}` : "";
    console.log(`    ${c.same ? "same     " : "MISMATCH "} ${c.season} (${c.reader}, v${c.version})${starts}`);
  }
  for (const n of report.notes) console.log(`  note: ${n}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.RULEBOOKS_DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (!url) throw new Error("set AUTH_DATABASE_URL (.env.local) or RULEBOOKS_DATABASE_URL");
  console.log(`[rulebooks] database host: ${new URL(url).hostname}`);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [BACKFILL_LOCK]);
    const report = await backfill(client);
    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
    print(report, { dryRun });
    if (report.checks.some((c) => !c.same)) process.exitCode = 1;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[rulebooks] failed:", e.message);
    process.exit(1);
  });
}

module.exports = { backfill, opsFromDelta, BACKFILL_LOCK };
