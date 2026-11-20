// Dev-only check of a sports week in progress (docs/PLAN-sports-ready.md step 1.1, part 2): a slate's week counts each game as it
// ends, early, so a table moves through Sunday; no head-to-head matchup is won or lost until the week's last game is final.
//
// On nfl-slate-fixture.js (the recorded NFL season through the stand-in ESPN; a game is being played for 3½ hours after its start,
// then final as recorded), four people on a head-to-head game of three a seat from --week (the football season game's rules with
// a team and a lineup of three: start-spec.ts startFromSpec, as the wizard starts one), each drafted two quarterbacks from Sunday's
// early games and one player from Monday night's game (the engine's own snake draft), their lineup the three:
//   Sunday evening      the hourly job's first run after Sunday's early games end (db/sports-refresh.js, world.hourly()): the week
//                       stamped early (ep.statEarly; resultsStage 'early'; not yet "has results", so lineups and waivers go on as
//                       before); the lines its games final so far, nobody's from Monday night; everyone's total moved by their two
//                       quarterbacks; every record still 0-0, nobody's last matchup, the week's the next; someone a week behind told
//                       nothing of it (SpoilerLogic.viewThrough)
//   Monday night over   the first run after its final: the week final (no statEarly), each seat's one game decided (a record of
//                       one game, the last matchup the week's, the next the week after); each total moved by its Monday night
//                       player alone: the week's final table with Monday night's lines left out is Sunday evening's
// Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-week-in-progress.js [--week=9] [--keep]
//
// Needs the local database and the NFL recording (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the
// fixture's (--keep leaves them; the next run removes them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const HOUR = 3600_000;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 500)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);
const iso = (t) => new Date(t).toISOString();
/** The hourly job's next run at or after `t`: five past an hour. */
const nextRun = (t) => {
  const d = new Date(t);
  d.setUTCMinutes(5, 0, 0);
  if (d.getTime() < t) d.setUTCHours(d.getUTCHours() + 1);
  return d.getTime();
};
/** A box score's first row of a table (passing, rushing...) for each team, by ESPN athlete id. */
const firstOf = (box, table) => Object.values(box ?? {}).map((team) => team.tables.find((t) => t.name === table)?.rows?.[0]?.id).filter(Boolean);

(async () => {
  const week = fx.weeksOf(fx.recording().input).find((w) => w.n === WEEK);
  if (!week || week.games.some((g) => g.state !== "post" || !g.box)) throw new Error(`--week=${WEEK} isn't a week the recording has played`);
  const last = week.games[week.games.length - 1];
  // Sunday's early games: the biggest start time shared by several games, the week's first Sunday.
  const starts = new Map();
  for (const g of week.games) starts.set(g.at, (starts.get(g.at) ?? 0) + 1);
  const early = [...starts].sort((a, b) => b[1] - a[1])[0][0];
  const sunday = week.games.filter((g) => g.at === early);
  if (sunday.length < 4) throw new Error(`${week.label} has ${sunday.length} games at its busiest start; the check wants four`);
  const w = await fx.up({ at: iso(Date.parse(week.first) - HOUR) });
  try {
    const S = fx.app("../../src/lib/game/state-logic.js");
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { startFromSpec } = fx.app("../../src/lib/server/start-spec.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");

    // The game: the football season game's rules, a team and a lineup of three, head to head from this week.
    const d = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    const spec = S.gameOf(await w.league(d.leagueId));
    const body = { spec: { ...structuredClone(spec), count: { start: 3 }, get: { ...spec.get, each: 3 }, span: { from: WEEK, to: w.slate.episodes } }, name: "ZT week in progress", tell: false };
    const s = await startFromSpec(w.users.ann, w.seasonId, w.couchId, body, new Date());

    // Who each seat drafts: two quarterbacks of Sunday's early games, and one of Monday night's (a quarterback or a runner).
    const { rows: cast } = await w.pool.query("SELECT id, provider_ids FROM season_cast WHERE season_id = $1", [w.seasonId]);
    const scOf = new Map(cast.flatMap((r) => Object.values(r.provider_ids ?? {}).map((v) => [String(v), r.id])));
    const qbs = sunday.slice(0, 4).flatMap((g) => firstOf(g.box, "passing"));
    const monday = [...firstOf(last.box, "passing"), ...firstOf(last.box, "rushing")];
    const wantEspn = [0, 1, 2, 3].map((i) => [qbs[2 * i], qbs[2 * i + 1], monday[i]]);
    if (wantEspn.flat().some((id) => !id || !scOf.has(id)) || new Set(wantEspn.flat()).size !== 12) throw new Error(`couldn't find twelve of the week's players among the season's people: ${JSON.stringify(wantEspn)}`);
    const names = ["ann", "bo", "cy", "di"];
    const seats = {};
    await withLeagueLock(s.leagueId, (st) => {
      for (const who of names.slice(1)) S.addPlayer(st, `zt_nfl_${who}`);
      st.players.forEach((p, i) => (seats[names[i]] = p.id));
      const byCast = new Map(st.castaways.map((c) => [c.seasonCastId, c.id]));
      const wants = Object.fromEntries(names.map((who, i) => [seats[who], wantEspn[i].map((id) => byCast.get(scOf.get(id)))]));
      for (let k = 0; k < 12; k++) {
        const turn = S.currentDraftTurn(st);
        S.draftToCurrentTurn(st, wants[turn.playerId].shift());
      }
      const ep = st.episodes.find((e) => e.number === WEEK);
      ep.lineups = Object.fromEntries(st.players.map((p) => [p.id, st.castaways.filter((c) => c.ownerIds.includes(p.id)).map((c) => c.id)]));
    });
    const read = async () => {
      const st = await readyLeague(s.leagueId, await w.league(s.leagueId));
      return { st, ep: st.episodes.find((e) => e.number === WEEK), table: Object.fromEntries(S.computeScores(st).map((r) => [r.playerId, r.total])), rows: S.computeScores(st) };
    };
    let r = await read();
    const teams = Object.fromEntries(r.st.players.map((p) => [p.id, r.st.castaways.filter((c) => c.ownerIds.includes(p.id)).map((c) => c.id)]));
    const byCast = new Map(r.st.castaways.map((c) => [c.seasonCastId, c.id]));
    const mondayIds = new Set(wantEspn.map((x) => byCast.get(scOf.get(x[2]))));
    check(Object.values(teams).every((t) => t.length === 3 && t.filter((id) => mondayIds.has(id)).length === 1) && Object.values(r.table).every((t) => t === 0), `four seats of three, each with one of Monday night's (${last.name}); everyone at 0 before ${week.label}`, { teams, table: r.table });
    const opp = S.MatchupLogic.view(r.st, seats.ann)?.next;
    fact(`${week.label}: Ann plays ${r.st.players.find((p) => p.id === opp?.opponent)?.name ?? "nobody"}; Sunday's early games at ${early.slice(11, 16)}Z (${sunday.length}), Monday night's at ${last.at.slice(11, 16)}Z`);

    // Sunday evening: the first hourly run after the early games end.
    await w.days(iso(Date.parse(early) - 6 * HOUR));
    const evening = nextRun(Date.parse(early) + fx.GAME_MS);
    w.advance(iso(evening));
    await w.hourly();
    r = await read();
    const sundayTable = r.table;
    const lines = Object.keys(r.ep?.statLines ?? {});
    check(r.ep?.statEarly === true && S.resultsStage(r.ep) === "early" && !S.episodeHasResults(r.ep), `the run at ${iso(evening).slice(5, 16)}Z: ${week.label} stamped early (in progress), without its results yet`, { statEarly: r.ep?.statEarly, stage: S.resultsStage(r.ep), has: S.episodeHasResults(r.ep) });
    check(lines.length > 0 && ![...mondayIds].some((id) => lines.includes(id)), `its lines are its games final so far (${lines.length}), nobody's from Monday night`, { mondayIn: [...mondayIds].filter((id) => lines.includes(id)) });
    check(Object.values(sundayTable).every((t) => t > 0), `everyone's total moved by their two quarterbacks: ${names.map((n) => `${n} ${sundayTable[seats[n]]}`).join(", ")}`, sundayTable);
    const view = S.MatchupLogic.view(r.st, seats.ann);
    check(r.rows.every((x) => x.matchups && x.matchups.wins + x.matchups.losses + x.matchups.ties === 0) && view && view.last === null && view.next?.episode === WEEK, `no matchup decided: every record 0-0, Ann's last matchup none, her next still ${week.label}`, { records: r.rows.map((x) => x.matchups), last: view?.last, next: view?.next });
    const behind = S.SpoilerLogic.viewThrough(r.st, WEEK - 1).episodes.find((e) => e.number === WEEK);
    check(!("statLines" in behind) && !("statEarly" in behind), "someone a week behind (hiding sports scores) is told nothing of the week in progress");

    // Monday night over: the first run after its final.
    const end = nextRun(Date.parse(last.at) + fx.GAME_MS);
    await w.days(iso(Date.parse(last.at) - HOUR));
    w.advance(iso(end));
    await w.hourly();
    r = await read();
    check(r.ep?.statEarly === undefined && S.resultsStage(r.ep) === "final" && S.episodeHasResults(r.ep), `the run at ${iso(end).slice(5, 16)}Z, after ${last.name}'s final: ${week.label} final`, { statEarly: r.ep?.statEarly, stage: S.resultsStage(r.ep) });
    const after = S.MatchupLogic.view(r.st, seats.ann);
    check(r.rows.every((x) => x.matchups && x.matchups.wins + x.matchups.losses + x.matchups.ties === 1) && after?.last?.episode === WEEK && after.last.result && after.next?.episode === WEEK + 1, `each seat's matchup decided: a record of one game, Ann's last ${week.label}'s (${after?.last?.result}, ${after?.last?.points} to ${after?.last?.against}), her next the week after`, { records: r.rows.map((x) => x.matchups), last: after?.last, next: after?.next });
    const without = structuredClone(r.st);
    const ep = without.episodes.find((e) => e.number === WEEK);
    for (const id of mondayIds) {
      delete ep.statLines[id];
      for (const g of Object.values(ep.statGames ?? {})) delete g[id];
    }
    const less = Object.fromEntries(S.computeScores(without).map((x) => [x.playerId, x.total]));
    const moved = names.map((n) => { const by = Math.round((r.table[seats[n]] - sundayTable[seats[n]]) * 100) / 100; return `${n} ${by < 0 ? "" : "+"}${by}`; }).join(", ");
    check(JSON.stringify(Object.entries(less).sort()) === JSON.stringify(Object.entries(sundayTable).sort()), `each total moved by its Monday night player alone (${moved}): the final table less Monday night's lines is Sunday evening's`, { less, sundayTable });

    console.log(failures ? "VERDICT (1.1 part 2): NOT YET" : "VERDICT (1.1 part 2): a week counts as it goes; its matchups wait for its last game");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
