// The game-specs flag (app_settings 'game-specs', db/game-specs.js; docs/PLAN-start-a-game-gpt.md step A2): what it is, a
// read-only check of what turning it on would do, and turning it on or off for every league.
//
//   node scripts/game-specs-flag.js status   the flag; how many leagues carry settings.game, and how many of those have
//                                            drifted from what their fields play
//   node scripts/game-specs-flag.js check    writes nothing: for every league, that the spec its fields play is one a
//                                            game plays with nothing wrong (as a league's own), that writing it back
//                                            changes nothing, and that it plays exactly the same carrying it as not:
//                                            its type and flags, sizes, waivers, joining, the draft, every moment's
//                                            points, and its scores after every episode. Exit 1 on any difference.
//   node scripts/game-specs-flag.js on       the flag on, then settings.game into every league (what its fields play)
//   node scripts/game-specs-flag.js off      the flag off, then settings.game out of every league: back on the fields,
//                                            which were never removed
//
// The database is GAME_SPECS_DATABASE_URL if set (a Neon branch, from the user's own terminal), else AUTH_DATABASE_URL
// (.env.local). It prints the host; on or off anywhere but localhost needs --yes. Each league is written under its own
// row lock (db/game-specs.js syncLeagueRow) and only when it changed; re-running picks up where a run stopped. Prints
// league ids only, never names.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const F = require("../db/game-specs.js");

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Everything the engine reads of a league's game, as it reads it: for comparing a league carrying its spec with not. */
function playedSnapshot(state) {
  const t = S.getLeagueType(state);
  const W = S.WaiverLogic;
  const A = S.ActiveRosterLogic;
  const ids = [...new Set([...Object.keys(state.settings.eventPoints || {}), ...S.formatOf(state).events.map((e) => e.id)])].sort();
  const waivers = W.supported(state);
  const numbers = [...new Set((state.episodes || []).map((e) => e.number))].sort((a, b) => a - b);
  return {
    type: [t.id, t.name, t.draftStrategy.name, t.scoringStrategy.name],
    flags: ["hasRoster", "hasWeeklyPicks", "hasActiveRoster", "hasCalls", "hasBingo", "supportsReplenish", "supportsTrade", "supportsFinalePredictions"].map((f) => !!t[f]),
    sizes: [S.rosterSize(state), A.activeSlots(state), A.benchSlots(state), S.GhostLogic.teamSize(state)],
    span: [S.startEpisode(state), S.endEpisode(state), S.gameOver(state), numbers.map((n) => S.inPlay(state, n))],
    waivers: waivers
      ? [W.config(state), W.replaceRule(state), W.windows(state), W.processHours(state), W.freeAgencyOn(state), W.rolling(state), W.shortAt(state), W.enabled(state), S.replenishAvailable(state), S.tradeAvailable(state), S.MidSeasonLogic.swapEvery(state), S.MidSeasonLogic.isShared(state)]
      : null,
    join: [S.GhostLogic.joinMode(state), S.GhostLogic.allowed(state), S.GhostLogic.lockedDown(state), S.GhostLogic.sharedJoin(state)],
    extras: [S.finalePredictionsAvailable(state), S.isDraftStarted(state), S.pickEmCallsOn(state), S.PickEmLogic.byScore(state)],
    points: ids.map((id) => [id, A.pointsFor(state, id)]),
    scores: S.computeScores(state).map((r) => [r.playerId, r.total, r.locked, r.bonus, r.finale, r.longestStreak ?? null]),
    // ...and as it stood after each episode (the spoiler guard's view: what someone that far along sees).
    through: numbers.map((n) => S.computeScores(S.SpoilerLogic.viewThrough(state, n)).map((r) => [r.playerId, r.total])),
  };
}

/**
 * One league's check: { ok, problems, waits, roundTrip, same, differs }. Its spec (what its fields play) has nothing wrong
 * as a league's own and plays today, writing it back changes nothing, and carrying it plays the same as not.
 */
function checkLeague(state) {
  const plain = clone(state);
  delete plain.settings.game;
  const spec = G.specOf(plain.settings);
  const problems = G.specProblems(spec, null, { league: true });
  const waits = G.specWaitsFor(spec);
  const roundTrip = G.sameValue(G.withSpec(plain.settings, spec), plain.settings);
  const carrying = clone(plain);
  F.carryGame(carrying.settings, true);
  const a = playedSnapshot(plain);
  const b = playedSnapshot(carrying);
  const differs = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  const same = !differs.length;
  return { ok: !problems.length && !waits.length && roundTrip && same, problems, waits, roundTrip, same, differs };
}

const leagueList = async (pool) => (await pool.query("SELECT id FROM leagues ORDER BY created_at, id")).rows;

/** The read-only check, every league. -> { leagues: [...], ok } */
async function check(pool, { log = console.log } = {}) {
  const leagues = [];
  for (const { id } of await leagueList(pool)) {
    const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [id]);
    const r = checkLeague(rows[0].state);
    leagues.push({ id, ...r });
    const why = [
      ...r.problems.map((p) => `${p.at}: ${p.problem}`),
      ...r.waits.map((w) => `${w.at}: ${w.problem}`),
      ...(r.roundTrip ? [] : ["writing its own spec back changes its settings"]),
      ...(r.same ? [] : [`plays differently carrying it (${r.differs.join(", ")})`]),
    ];
    log(`  ${r.ok ? "ok  " : "FAIL"} league ${id}: ${r.ok ? `${G.specOf(rows[0].state.settings).preset}, plays the same carrying its spec` : why.join("; ")}`);
  }
  return { leagues, ok: leagues.every((l) => l.ok) };
}

/** Turns the flag on or off, then walks every league. -> { written, unchanged } */
async function flip(pool, on, { log = console.log } = {}) {
  if (on) {
    const { ok } = await check(pool, { log: () => {} });
    if (!ok) throw new Error("a league doesn't play the same carrying its spec (run check): not turning it on");
  }
  await F.setGameSpecsOn(pool, on);
  log(`[game-specs] flag ${on ? "on" : "off"}; syncing every league`);
  const tally = { written: 0, unchanged: 0 };
  for (const { id } of await leagueList(pool)) {
    const r = await F.syncLeagueRow(pool, id, on);
    if (!r) continue;
    if (r.saved) tally.written += 1;
    else tally.unchanged += 1;
  }
  log(`[game-specs] ${tally.written} ${on ? "now carry their spec" : "carry it no longer"}, ${tally.unchanged} already in step`);
  return tally;
}

async function status(pool, { log = console.log } = {}) {
  const on = await F.gameSpecsOn(pool);
  const { rows } = await pool.query("SELECT id, state->'settings' AS settings FROM leagues");
  const carrying = rows.filter((r) => r.settings && r.settings.game !== undefined);
  const drifted = carrying.filter((r) => !G.sameValue(r.settings.game, G.specOf(r.settings)));
  log(`[game-specs] flag ${on ? "ON" : "off"}; ${carrying.length} of ${rows.length} leagues carry settings.game, ${drifted.length} drifted from their fields`);
  for (const r of drifted) log(`  drifted: league ${r.id}`);
  return { on, leagues: rows.length, carrying: carrying.length, drifted: drifted.length };
}

async function main() {
  const [command] = process.argv.slice(2);
  const url = process.env.GAME_SPECS_DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (!url) throw new Error("set AUTH_DATABASE_URL (.env.local) or GAME_SPECS_DATABASE_URL");
  const host = new URL(url).hostname;
  console.log(`[game-specs] database host: ${host}`);
  if (["on", "off"].includes(command) && !["localhost", "127.0.0.1"].includes(host) && !process.argv.includes("--yes")) {
    throw new Error("that isn't the local database: check the host above, then add --yes");
  }
  const pool = new Pool({ connectionString: url });
  try {
    if (command === "status") await status(pool);
    else if (command === "check") {
      const { ok } = await check(pool);
      console.log(`[game-specs] check: ${ok ? "PASS" : "FAIL"}`);
      if (!ok) process.exitCode = 1;
    } else if (command === "on" || command === "off") await flip(pool, command === "on");
    else throw new Error("usage: node scripts/game-specs-flag.js status | check | on | off [--yes]");
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[game-specs]", e.message);
    process.exit(1);
  });
}

module.exports = { playedSnapshot, checkLeague, check, flip, status };
