// The rulebooks flag (app_settings 'rulebooks', db/rulebooks.js; docs/PLAN-new-design.md step R3): what it is, a
// read-only check of what turning it on would do, and turning it on or off for every league.
//
//   node scripts/rulebooks-flag.js status   the flag; how many leagues carry settings.rulebook, and how many are behind
//   node scripts/rulebooks-flag.js check    writes nothing: for every league, what syncLeagueRulebook would write and
//                                           that the league scores exactly the same with it (scores, every event and
//                                           its points, the season's end, the catalog); and for every season, that
//                                           its rulebook is the format its research reads. Each league in its own
//                                           rolled-back transaction. Exit 1 on any difference.
//   node scripts/rulebooks-flag.js on       the backfill (db/backfill-rulebooks.js; refuses if a season's rulebook
//                                           isn't its format), the flag on, then settings.rulebook into every league
//   node scripts/rulebooks-flag.js off      the flag off, then settings.rulebook out of every league: back on
//                                           showFormat / leagueRulesetData, which were never removed
//
// The database is RULEBOOKS_DATABASE_URL if set (a Neon branch, from the user's own terminal), else AUTH_DATABASE_URL
// (.env.local). It prints the host; on or off anywhere but localhost needs --yes. Each league is written under its
// own row lock (db/rulebooks.js syncLeagueRow) and only when its settings.rulebook changed; re-running picks up where
// a run stopped.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const S = require("../src/lib/game/state-logic.js");
const R = require("../db/rulebooks.js");
const ShowFormats = require("../db/show-formats.js");
const { backfill, BACKFILL_LOCK } = require("../db/backfill-rulebooks.js");

/** Everything a league's rules decide, for comparing two states: standings, each episode's events and points, the end. */
function scoringSnapshot(state) {
  const format = S.formatOf(state);
  return {
    scores: S.computeScores(state),
    events: (state.episodes || []).map((ep) => S.ActiveRosterLogic.episodeEvents(state, ep).map((e) => [e.type, e.castawayId, S.ActiveRosterLogic.eventPoints(state, e)])),
    ended: S.seasonEnded(state),
    winner: (S.seasonWinner(state) || {}).id || null,
    catalog: format.events.map((e) => [e.id, e.defaultPoints, !!e.implied]),
    exits: [format.exitMethods, format.winnerExitMethod, format.endgameExitMethods],
  };
}

/** Whether `state` with its settings.rulebook scores as it does without one: { same, rules, differs? }. */
function comparePlayed(state) {
  const plain = structuredClone(state);
  delete plain.settings.rulebook;
  const a = scoringSnapshot(state);
  const b = scoringSnapshot(plain);
  const differs = Object.keys(a).filter((k) => !R.sameData(a[k], b[k]));
  return { same: !differs.length, rules: R.sameData(S.formatOf(state).data, S.formatOf(plain).data), differs };
}

const leagueList = async (pool) => (await pool.query("SELECT id, slug FROM leagues ORDER BY created_at")).rows;

/** The read-only check: every league and season, nothing written. -> { leagues: [...], seasons: [...], ok } */
async function check(pool, { log = console.log } = {}) {
  const leagues = [];
  for (const l of await leagueList(pool)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT state FROM leagues WHERE id=$1", [l.id]);
      const state = rows[0].state;
      const result = await R.syncLeagueRulebook(client, l.id, state.settings, { on: true });
      const compared = result.written ? comparePlayed(state) : null;
      leagues.push({ slug: l.slug, ...result, ...(compared || {}) });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }
  const seasons = [];
  const { rows } = await pool.query("SELECT ss.id, ss.season_number, s.slug, s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id ORDER BY s.slug, ss.season_number");
  for (const ss of rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { row } = await R.ensureSeasonRulebook(client, ss.id);
      const ruled = await R.seasonRulebookFormat(client, ss.id, { formatId: ss.format, on: true });
      const today = await ShowFormats.resolveFormat(client, ss.format);
      seasons.push({ season: `${ss.slug} ${ss.season_number}`, ruled: !!ruled, same: !ruled || (R.sameData(ruled.data, today.data) && row.reader === R.readerOf(today)) });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }
  for (const l of leagues) {
    const what = l.written ? `${l.source} rulebook v${l.version}: ${l.same && l.rules ? "scores the same" : `DIFFERS (${l.differs.join(", ") || "rules"})`}` : `stays on the old path: ${l.mismatch || l.reason}`;
    log(`  ${l.written && !(l.same && l.rules) ? "FAIL" : l.mismatch ? "NOTE" : "ok  "} league ${l.slug}: ${what}`);
  }
  for (const s of seasons) log(`  ${s.same ? "ok  " : "FAIL"} season ${s.season}: ${s.ruled ? (s.same ? "its rulebook is the format research reads" : "its rulebook ISN'T the format research reads") : "research keeps today's path"}`);
  const ok = leagues.every((l) => !l.written || (l.same && l.rules)) && seasons.every((s) => s.same);
  return { leagues, seasons, ok };
}

/** Turns the flag on (after the backfill) or off, then walks every league. -> { written, removed, unchanged, stayed: [...] } */
async function flip(pool, on, { log = console.log } = {}) {
  if (on) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [BACKFILL_LOCK]);
      const report = await backfill(client);
      const bad = report.checks.filter((c) => !c.same);
      if (bad.length) {
        await client.query("ROLLBACK");
        throw new Error(`a season's rulebook isn't its format (${bad.map((c) => c.season).join(", ")}): not turning it on`);
      }
      await client.query("COMMIT");
      log(`[rulebooks] backfill: ${Object.entries(report.counts).map(([k, c]) => `${k} ${c.created} new, ${c.updated} refreshed`).join("; ")}`);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  await R.setRulebooksOn(pool, on);
  log(`[rulebooks] flag ${on ? "on" : "off"}; syncing every league`);
  const tally = { written: 0, removed: 0, unchanged: 0, stayed: [] };
  for (const l of await leagueList(pool)) {
    const r = await R.syncLeagueRow(pool, l.id, { on });
    if (!r) continue;
    if (r.saved && r.written) tally.written += 1;
    else if (r.saved) tally.removed += 1;
    else tally.unchanged += 1;
    if (on && !r.written) tally.stayed.push(`${l.slug}: ${r.mismatch || r.reason}`);
  }
  log(`[rulebooks] ${tally.written} written, ${tally.removed} removed, ${tally.unchanged} already in step`);
  for (const s of tally.stayed) log(`  on the old path: ${s}`);
  return tally;
}

async function status(pool, { log = console.log } = {}) {
  const on = await R.rulebooksOn(pool);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS leagues,
            count(*) FILTER (WHERE l.state->'settings' ? 'rulebook')::int AS carrying,
            count(*) FILTER (WHERE (l.state->'settings'->'rulebook'->>'version')::int < r.version)::int AS behind
       FROM leagues l LEFT JOIN rulebooks r ON r.id::text = l.state->'settings'->'rulebook'->>'id'`
  );
  const { rows: books } = await pool.query("SELECT owner_kind, count(*)::int AS n FROM rulebooks WHERE status <> 'archived' GROUP BY owner_kind ORDER BY owner_kind");
  log(`[rulebooks] flag ${on ? "ON" : "off"}; ${rows[0].carrying} of ${rows[0].leagues} leagues carry settings.rulebook, ${rows[0].behind} behind their rulebook`);
  log(`[rulebooks] rulebooks: ${books.map((b) => `${b.n} ${b.owner_kind}`).join(", ") || "none (run db/backfill-rulebooks.js)"}`);
  return { on, ...rows[0] };
}

async function main() {
  const [command] = process.argv.slice(2);
  const url = process.env.RULEBOOKS_DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (!url) throw new Error("set AUTH_DATABASE_URL (.env.local) or RULEBOOKS_DATABASE_URL");
  const host = new URL(url).hostname;
  console.log(`[rulebooks] database host: ${host}`);
  if (["on", "off"].includes(command) && !["localhost", "127.0.0.1"].includes(host) && !process.argv.includes("--yes")) {
    throw new Error(`that isn't the local database: check the host above, then add --yes`);
  }
  const pool = new Pool({ connectionString: url });
  try {
    if (command === "status") await status(pool);
    else if (command === "check") {
      const { ok } = await check(pool);
      console.log(`[rulebooks] check: ${ok ? "PASS" : "FAIL"}`);
      if (!ok) process.exitCode = 1;
    } else if (command === "on" || command === "off") await flip(pool, command === "on");
    else throw new Error("usage: node scripts/rulebooks-flag.js status | check | on | off [--yes]");
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[rulebooks]", e.message);
    process.exit(1);
  });
}

module.exports = { scoringSnapshot, comparePlayed, check, flip, status };
