// The rulebooks flag's check and switch (app_settings 'rulebooks', db/rulebooks.js; docs/PLAN-new-design.md step R3), for
// scripts/rulebooks-flag.js and the desk's Settings › Games on their rulebook (docs/PLAN-desk-parity.md part 7c).
//
//   check(pool)     writes nothing: for every league, what syncLeagueRulebook would write and that the league scores exactly
//                   the same with it (scores, every event and its points, the season's end, the catalog); and for every
//                   season, that its rulebook is the format its research reads. Each in its own rolled-back transaction.
//   flip(pool, on)  on: the backfill (db/backfill-rulebooks.js; refuses if a season's rulebook isn't its format), the flag on,
//                   then settings.rulebook into every league. Off: the flag off, then each league as its own season decides:
//                   a season switched on by itself (show_seasons.rulebook_live) and a couch's own copy stay on their
//                   rulebook; everything else goes back on showFormat / leagueRulesetData, which were never removed.
//
// Plain CommonJS, no environment of its own (the script reads .env.local; the app has its own).
const S = require("../src/lib/game/state-logic.js");
const R = require("./rulebooks.js");
const ShowFormats = require("./show-formats.js");
const { backfill, BACKFILL_LOCK } = require("./backfill-rulebooks.js");

// A list compared as a set: each item by its content, whatever order its keys came back in (jsonb's own).
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const asSet = (list) => list.map((x) => JSON.stringify(sortKeys(x))).sort();

/**
 * Everything a league's rules decide, for comparing two states: standings, each episode's events and points, the end. With
 * `sets`, each episode's events and the catalog are sets: a built-in's blocks compiled list them in their own order.
 */
function scoringSnapshot(state, { sets = false } = {}) {
  const format = S.formatOf(state);
  const events = (state.episodes || []).map((ep) => S.ActiveRosterLogic.episodeEvents(state, ep).map((e) => [e.type, e.castawayId, S.ActiveRosterLogic.eventPoints(state, e)]));
  const catalog = format.events.map((e) => [e.id, e.defaultPoints, !!e.implied]);
  return {
    scores: S.computeScores(state),
    events: sets ? events.map(asSet) : events,
    ended: S.seasonEnded(state),
    winner: (S.seasonWinner(state) || {}).id || null,
    catalog: sets ? asSet(catalog) : catalog,
    exits: [format.exitMethods, format.winnerExitMethod, format.endgameExitMethods],
  };
}

/**
 * Whether `state` with its settings.rulebook scores as it does without one: { same, rules, differs? }. A rulebook that's
 * its built-in's blocks compiled (a season made since docs/PLAN-start-a-game-gpt.md S2, at its `phaseStarts`) has those
 * blocks' rules, not the format's data, in their order: its events and catalog compare as sets.
 */
function comparePlayed(state, { phaseStarts = {} } = {}) {
  const plain = structuredClone(state);
  delete plain.settings.rulebook;
  const book = state.settings.rulebook;
  const blocks = book && book.reader === "research" ? R.builtInBlocksCompile(S.formatOf(plain).id, phaseStarts) : null;
  const fromBlocks = !!blocks && R.sameData(book.data, blocks);
  const a = scoringSnapshot(state, { sets: fromBlocks });
  const b = scoringSnapshot(plain, { sets: fromBlocks });
  const differs = Object.keys(a).filter((k) => !R.sameData(a[k], b[k]));
  return { same: !differs.length, rules: fromBlocks || R.sameData(S.formatOf(state).data, S.formatOf(plain).data), differs };
}

// Deleted leagues too: one restored plays by what the flag says, so the switch walks it, and the check says it's deleted.
const leagueList = async (pool) => (await pool.query("SELECT id, slug, name, deleted_at IS NOT NULL AS deleted FROM leagues ORDER BY created_at")).rows;

/**
 * The read-only check: every league and season, nothing written. `progress(done, total)` hears each one checked.
 * -> { leagues: [{ id, slug, name, deleted, written, same?, rules?, differs?, mismatch?, reason? }], seasons: [{ id, season, ruled, same }], ok }
 */
async function check(pool, { log = console.log, progress = null } = {}) {
  const list = await leagueList(pool);
  const { rows: seasonRows } = await pool.query("SELECT ss.id, ss.season_number, s.slug, s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id ORDER BY s.slug, ss.season_number");
  const total = list.length + seasonRows.length;
  let done = 0;
  const tick = async () => {
    done += 1;
    if (progress) await progress(done, total);
  };
  const leagues = [];
  for (const l of list) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT state FROM leagues WHERE id=$1", [l.id]);
      // A league deleted for good since the list was read has nothing to check.
      if (rows.length) {
        const state = rows[0].state;
        const result = await R.syncLeagueRulebook(client, l.id, state.settings, { on: true });
        const compared = result.written ? comparePlayed(state, { phaseStarts: (await R.getRulebook(client, result.id)).phaseStarts }) : null;
        leagues.push({ id: l.id, slug: l.slug, name: l.name, deleted: l.deleted, ...result, ...(compared || {}) });
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    await tick();
  }
  const seasons = [];
  for (const ss of seasonRows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { row } = await R.ensureSeasonRulebook(client, ss.id);
      const ruled = await R.seasonRulebookFormat(client, ss.id, { formatId: ss.format, on: true });
      const today = await ShowFormats.resolveFormat(client, ss.format);
      seasons.push({ id: ss.id, season: `${ss.slug} ${ss.season_number}`, ruled: !!ruled, same: !ruled || R.isFormatsRules(row, today) });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    await tick();
  }
  for (const l of leagues) {
    const what = l.written ? `${l.source} rulebook v${l.version}: ${l.same && l.rules ? "scores the same" : `DIFFERS (${l.differs.join(", ") || "rules"})`}` : `stays on the old path: ${l.mismatch || l.reason}`;
    log(`  ${l.written && !(l.same && l.rules) ? "FAIL" : l.mismatch ? "NOTE" : "ok  "} league ${l.slug}: ${what}`);
  }
  for (const s of seasons) log(`  ${s.same ? "ok  " : "FAIL"} season ${s.season}: ${s.ruled ? (s.same ? "its rulebook is the format research reads" : "its rulebook ISN'T the format research reads") : "research keeps today's path"}`);
  const ok = leagues.every((l) => !l.written || (l.same && l.rules)) && seasons.every((s) => s.same);
  return { leagues, seasons, ok };
}

/**
 * Turns the flag on (after the backfill) or off, then walks every league, each as its season now decides: off keeps a season
 * switched on by itself, and a couch's own copy, on their rulebook. -> { written, removed, unchanged, stayed: [...] }
 */
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
        const err = new Error(`a season's rulebook isn't its format (${bad.map((c) => c.season).join(", ")}): not turning it on`);
        err.seasons = bad.map((c) => c.season);
        throw err;
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
    // No `on`: the league's own season decides (the flag, its rulebook_live, or its couch's own copy).
    const r = await R.syncLeagueRow(pool, l.id);
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

module.exports = { scoringSnapshot, comparePlayed, check, flip, status };
