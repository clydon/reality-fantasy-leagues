// Dev-only check of a pool's series of totals (docs/PLAN-start-a-game-gpt.md track C, C2 part 4b: game-spec schema.js poolByPoints,
// matchupParts, teamParts and handicapParts on a pool; settings.js poolRank 'total' | 'matchups' with rankMatchups, rankTeams and
// rankHandicap; state-logic.js PickEmLogic.series, MatchupLogic.seatSeries, rankKey, PickEmLogic.eligibility's end at head to
// head's final; game-view.ts's table showing a pool's points) against the dev server, through the API (no screens: they're the UI
// track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode
// 6 three days off; Pool Party, the couch's Survival Pool, its picks through 5). Expectations are the engine's own reading of each
// copy, so the check proves the server reads a pool's series as the engine does (the numbers by hand are tests/pool-series.test.js's).
// In order:
//   - Pool Party made head to head through Episode 7, the top two in the playoffs (its last episode), through RosterLogic.setGame with
//     the show's ctx (its fields: poolRank 'matchups', rankMatchups; still a Survival Pool). The Games tab as jordan reads it: each
//     row's record as the engine has it, the table's number its points (not its streak), the playoffs at 7.
//   - Picks for Episode 6 through the picks route; Episode 6 through the season sync (riley's pick voted out): the regular season
//     over, the top two seeded.
//   - Picks for Episode 7, the final, through the route; Episode 7 through the season sync (the top seed's pick voted out): the
//     second seed the champion, first in the table, the game over; a pick for Episode 8 (if it's there) not taken.
//   - Pool Party made a game in two teams drawn, ranked by their points summed: each row's side the engine's, each team's points its
//     members' added up, ranked by them.
//   - Pool Party ranked by its points with a handicap: a write through the route stamps the couch's history (everyone new to it), each
//     row's handicap the engine's, a point for each decided episode.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-pool-series.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-pool-series runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Two records maps the same, whatever order their keys are in (the table's is its rank's). */
const sameBy = (a, b) => same(Object.entries(a).sort(), Object.entries(b).sort());

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const sid = fx.seasonId;
    const L = fx.leagues.pool;
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), L]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = whoIs(user_id);
      if (who) pids[who] = player_id;
    }
    const whoOf = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    // A game's spec changed as the engine writes one (there's no screen for it yet): setGame with the show's ctx.
    const setGame = async (changes) => {
      const st = await league();
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(L, sid);
      const problems = S.setGame(st, { ...S.gameOf(st), ...changes }, { ctx });
      if (!problems.length) await write(st);
      return problems;
    };
    const decide = async (n, name) => {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now(), false)`,
        [sid, n, name]
      );
      await syncSeasonLeagues(sid, null);
    };
    const pickThrough = async (who, n, castawayId) => {
      const st = await league();
      const ep = st.episodes.find((e) => e.number === n);
      return as[who].call("PUT", `/api/leagues/${L}/episodes/${ep.id}/picks`, { playerId: pids[who], castawayId });
    };
    const pickOf = (st, n, who) => S.pickEmPickFor(st, st.episodes.find((e) => e.number === n).id, pids[who])?.castawayId ?? null;
    const records = (rows) => Object.fromEntries((rows ?? []).map((r) => [whoIs(r.userId), r.record ? `${r.record.wins}-${r.record.losses}-${r.record.ties}` : null]));
    const engineRecords = (st) => {
      const w = S.MatchupLogic.run(st);
      return Object.fromEntries(WHO.map((who) => { const r = w.records.get(pids[who]) || { wins: 0, losses: 0, ties: 0 }; return [who, `${r.wins}-${r.losses}-${r.ties}`]; }));
    };
    const pointsAt = (st, n) => {
      const x = S.PickEmLogic.series(st).filter((e) => e.number <= n).pop();
      return Object.fromEntries(WHO.map((who) => [who, x ? x.totals.get(pids[who]) || 0 : 0]));
    };

    // ---------- head to head through Episode 7, the top two in the playoffs ----------
    let problems = await setGame({ span: { from: 1, to: 7 }, rank: { by: "matchups", playoffs: { teams: 2 } } });
    let st = await league();
    check(!problems.length && st.settings.poolRank === "matchups" && same(st.settings.rankMatchups, { playoffs: { teams: 2 } }) && S.getLeagueType(st).id === "pickem",
      "Pool Party made head to head through Episode 7, the top two in the playoffs (poolRank matchups, rankMatchups; still a Survival Pool)", JSON.stringify({ problems, rank: st.settings.poolRank, m: st.settings.rankMatchups }));
    for (const who of WHO) await seen(who, 5);
    let g = await gameIn("jordan");
    const p5 = pointsAt(st, 5);
    check(sameBy(records(g?.table), engineRecords(st)) && (g?.table ?? []).every((r) => r.total === r.points && r.points === p5[whoIs(r.userId)]),
      `  the Games tab as jordan reads it (seen through 5): each row's record as the engine has it (${JSON.stringify(engineRecords(st))}), the table's number its points (${JSON.stringify(p5)}), not its streak`,
      JSON.stringify({ api: records(g?.table), rows: (g?.table ?? []).map((r) => [whoIs(r.userId), r.total, r.points]) }));
    check(g?.matchups?.playoffs?.from === 7 && g?.matchups?.playoffs?.rounds === 1 && g?.to === 7, "  the playoffs: one round, at Episode 7, the game's last", JSON.stringify({ playoffs: g?.matchups?.playoffs, to: g?.to }));

    // ---------- Episode 6: the regular season's last ----------
    st = await league();
    const avail = (s, n, who) => S.pickEmEligibility(s, s.episodes.find((e) => e.number === n).id, pids[who]).available;
    // Everyone picks someone still in for 6; riley's goes home (someone nobody else picked, where there's one).
    for (const who of ["alex", "jordan", "sam"]) await pickThrough(who, 6, avail(st, 6, who)[0]);
    st = await league();
    const others6 = new Set(["alex", "jordan", "sam"].map((w) => pickOf(st, 6, w)));
    const rileys = avail(st, 6, "riley").filter((id) => !others6.has(id));
    await pickThrough("riley", 6, (rileys.length ? rileys : avail(st, 6, "riley"))[0]);
    st = await league();
    const picked6 = Object.fromEntries(WHO.map((w) => [w, pickOf(st, 6, w)]));
    check(WHO.every((w) => !!picked6[w]), "Picks for Episode 6 through the picks route, one each", JSON.stringify(picked6));
    const goner6 = S.getCastaway(st, picked6.riley);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, goner6.name);
    st = await league();
    let w = S.MatchupLogic.run(st);
    const p6 = pointsAt(st, 6);
    check(S.PickEmLogic.decided(st.episodes.find((e) => e.number === 6), st) && p6.riley === pointsAt(st, 5).riley && Array.isArray(w?.seeds) && w.seeds.length === 2,
      `Episode 6 through the season sync (${goner6.name}, riley's pick, voted out): the regular season over, seeded ${JSON.stringify((w?.seeds ?? []).map(whoOf))} on ${JSON.stringify(engineRecords(st))}`,
      JSON.stringify({ p6, seeds: w?.seeds }));
    for (const who of WHO) await seen(who, 6);
    g = await gameIn("alex");
    check(sameBy(records(g?.table), engineRecords(st)) && same((g?.matchups?.playoffs?.seeds ?? []).map(whoOf), (w?.seeds ?? []).map(whoOf)),
      "  the Games tab as alex reads it (seen through 6): the records and the seeds as the engine has them", JSON.stringify({ api: records(g?.table), seeds: g?.matchups?.playoffs?.seeds }));

    // ---------- Episode 7, the final ----------
    const [s1, s2] = (w?.seeds ?? []).map(whoOf);
    st = await league();
    const ep7 = st.episodes.find((e) => e.number === 7);
    check(!!ep7, "  Episode 7 is there to pick for", JSON.stringify(st.episodes.map((e) => e.number)));
    await pickThrough(s1, 7, avail(st, 7, s1)[0]);
    st = await league();
    await pickThrough(s2, 7, avail(st, 7, s2).find((id) => id !== pickOf(st, 7, s1)));
    for (const who of WHO.filter((x) => x !== s1 && x !== s2)) { st = await league(); await pickThrough(who, 7, avail(st, 7, who)[0]); }
    st = await league();
    const goner7 = S.getCastaway(st, pickOf(st, 7, s1));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, goner7.name);
    st = await league();
    w = S.MatchupLogic.run(st);
    check(whoOf(w?.champion) === s2 && S.gameOver(st) && S.lastEpisode(st) === 7,
      `Episode 7, the final (${goner7.name}, ${s1}'s pick, voted out): ${s2} the champion over the top seed, the game over`, JSON.stringify({ champion: whoOf(w?.champion), rounds: w?.rounds }));
    for (const who of WHO) await seen(who, 7);
    g = await gameIn("riley");
    check(g?.over === true && whoIs(g?.table?.[0]?.userId) === s2 && g?.table?.[0]?.record?.champion === true,
      `  the Games tab as riley reads it: over, ${s2} first and the champion`, JSON.stringify({ over: g?.over, first: g?.table?.[0] }));
    const ep8 = st.episodes.find((e) => e.number === 8);
    if (ep8) {
      const r = await as.sam.call("PUT", `/api/leagues/${L}/episodes/${ep8.id}/picks`, { playerId: pids.sam, castawayId: avail(st, 7, "sam")[0] ?? st.castaways.find((c) => c.status === "active").id });
      const after = await league();
      check(r.status === 200 && pickOf(after, 8, "sam") === null && same(S.pickEmEligibility(after, ep8.id, pids.sam).available, []),
        "  a pick for Episode 8 through the route isn't taken: nobody picks after the final", `${r.status} ${JSON.stringify(pickOf(after, 8, "sam"))}`);
    } else check(true, "  no Episode 8 past the game's end to pick for");

    // ---------- two teams, drawn, ranked by their points summed ----------
    problems = await setGame({ rank: { by: "total", teams: { of: 2, score: "sum" } } });
    st = await league();
    g = await gameIn("jordan");
    const rows = g?.table ?? [];
    const sides = Object.fromEntries(rows.map((r) => [whoIs(r.userId), r.side?.id ?? null]));
    const sums = {};
    rows.forEach((r) => { if (r.side) sums[r.side.id] = (sums[r.side.id] || 0) + r.points; });
    check(!problems.length && st.settings.poolRank === "total" && same(st.settings.rankTeams, { of: 2, score: "sum" })
      && WHO.every((w) => sides[w] === S.TeamLogic.sideOf(st, pids[w])) && rows.every((r) => r.side && r.side.points === sums[r.side.id])
      && rows.every((r, i) => i === 0 || rows[i - 1].side.points >= r.side.points),
      `Pool Party made a game in two teams drawn, ranked by their points summed: each row's side the engine's (${JSON.stringify(sides)}), each team's points its members' (${JSON.stringify(sums)}), ranked by them`,
      JSON.stringify({ problems, rows: rows.map((r) => [whoIs(r.userId), r.points, r.side]) }));

    // ---------- ranked by its points, with a handicap ----------
    problems = await setGame({ rank: { by: "total", handicap: { points: 1 } } });
    // A write through the route (a pick for an episode that's over: refused, the write's stamp still read) stamps the history.
    await pickThrough("sam", 7, avail(await league(), 7, "sam")[0] ?? picked6.sam);
    st = await league();
    g = await gameIn("sam");
    const decided = S.HandicapLogic.played(st).length;
    const want = Object.fromEntries(S.computeScores(st).map((r) => [whoOf(r.playerId), [r.handicap, r.total]]));
    const got = Object.fromEntries((g?.table ?? []).map((r) => [whoIs(r.userId), [r.handicap, r.points]]));
    check(!problems.length && same(st.settings.rankHandicap, { points: 1 }) && !!st.seatHistory && WHO.every((x) => want[x][0] === decided) && same(got, want),
      `Pool Party ranked by its points with a handicap: the history stamped (everyone new to the couch), a point each for the ${decided} decided episodes, the Games tab's handicap and points the engine's`,
      JSON.stringify({ problems, history: st.seatHistory, want, got }));
  } catch (e) {
    failures++;
    console.log("FAIL  threw:", e && e.stack ? e.stack : e);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `${failures} failed` : "ALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
