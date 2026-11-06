// A pool's series of totals (docs/PLAN-start-a-game-gpt.md track C, C2 part 4b): a pool ranked by its points (a right pick's), and
// head to head, teams of players and a handicap on them, each reading the pool's series (PickEmLogic.series: each episode the pool
// has decided, every seat's points through it, a handicap's added), the shape a draft's (ScoringLogic.walk's) and a game of
// questions' walk have. A pool with lives still ranks by its streak or last one standing. Their shape, words and settings; the
// series, the table, head to head's weeks and playoffs (and no pick after its final), the teams' points and the handicap, on one
// made-up season whose every number is worked out by hand below. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const CTX = {
  moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};
const ats = (problems) => problems.map((p) => p.at);
const POOL = { preset: "survival-pool" };
const pool = (rank, score = {}, get = null) => ({ ...POOL, score: { by: "survive", means: "staysIn", points: 1, ...score }, ...(get ? { get: { by: "pick", each: 1, repeat: "cycle", ...get } } : {}), rank });
const WORDS = { show: "Survivor 51", castaway: "castaway" };

function league(spec, ids = ["ann", "bo", "cy", "di"], n = 10) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = ids.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= 7; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
function picks(s, n, who) {
  for (const [p, x] of Object.entries(who)) {
    const [first, second] = Array.isArray(x) ? x : [x];
    S.setPickEmPick(s, ep(s, n).id, p, cid(s, first));
    if (second !== undefined) S.setPickEmPick(s, ep(s, n).id, p, cid(s, second), { second: true });
  }
}
const gone = (s, n, ...out) => out.forEach((i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out"));
/**
 * The season (a right pick 1 point):
 *   Ep 1: C9 out.   ann C0 (right), bo C9 (wrong), cy C1 (right), di no pick         ann 1 bo 0 cy 1 di 0
 *   Ep 2: C8 out.   ann C1, bo C2, cy C8 (wrong), di C3                              ann 1 bo 1 cy 0 di 1
 *   Ep 3: nobody.   ann C2, bo C3, cy C0, di no pick (a miss)                        ann 1 bo 1 cy 1 di 0
 *   Ep 4: C7 out.   ann C7 (wrong), bo C0, cy C2, di C1                              ann 0 bo 1 cy 1 di 1
 *   Ep 5: C6 out, its early results (who went home: a pool's decided).
 *                   ann C3, bo C6 (wrong), cy C3, di C6 (wrong)                      ann 1 bo 0 cy 1 di 0
 * Through each: ann 1 2 3 3 4, bo 0 1 2 3 3, cy 1 1 2 3 4, di 0 1 1 2 2.
 */
function season(s) {
  picks(s, 1, { ann: 0, bo: 9, cy: 1 });
  gone(s, 1, 9);
  picks(s, 2, { ann: 1, bo: 2, cy: 8, di: 3 });
  gone(s, 2, 8);
  picks(s, 3, { ann: 2, bo: 3, cy: 0 });
  S.EpisodeLogic.setNoExit(s, ep(s, 3).id, true);
  picks(s, 4, { ann: 7, bo: 0, cy: 2, di: 1 });
  gone(s, 4, 7);
  picks(s, 5, { ann: 3, bo: 6, cy: 3, di: 6 });
  gone(s, 5, 6);
  S.EpisodeLogic.setResultsStage(s, ep(s, 5).id, "early");
  return s;
}
const THROUGH = { ann: [1, 2, 3, 3, 4], bo: [0, 1, 2, 3, 3], cy: [1, 1, 2, 3, 4], di: [0, 1, 1, 2, 2] };
const seriesOf = (s) => S.PickEmLogic.series(s).map((x) => [x.number, x.quiet, ...["ann", "bo", "cy", "di"].map((p) => x.totals.get(p))]);
const EXPECTED = [1, 2, 3, 4, 5].map((n, i) => [n, n === 3, THROUGH.ann[i], THROUGH.bo[i], THROUGH.cy[i], THROUGH.di[i]]);

test("a pool ranked by its points, head to head, in teams or with a handicap: its shape, words and settings; with lives, refused", () => {
  const at = (spec) => ats(G.specProblems(spec, CTX));
  const total = pool({ by: "total" });
  const h2h = pool({ by: "matchups", playoffs: { teams: 2 } });
  const teams = pool({ by: "total", teams: { of: 2, score: "sum" } });
  const handicap = pool({ by: "total", handicap: { points: 1 } });
  for (const s of [total, h2h, teams, handicap, pool({ by: "matchups", teams: { of: 2 } }), pool({ by: "total" }, { means: "scores" }), pool({ by: "total" }, {}, { repeat: "never" }), pool({ by: "total" }, {}, { second: { fallback: "counts" } })]) {
    assert.deepEqual(at(s), [], JSON.stringify(s.rank));
    assert.deepEqual(G.specWaitsFor(s), [], JSON.stringify(s.rank));
    assert.equal(G.typeOf(s), "pickem");
    // Back from the settings they write, whole (poolRank, rankMatchups, rankTeams, rankHandicap).
    assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...G.settingsOf(s) }), G.fullSpec(s)), JSON.stringify(s.rank));
  }
  assert.deepEqual([G.settingsOf(total).poolRank, G.settingsOf(h2h).poolRank, G.settingsOf(POOL).poolRank], ["total", "matchups", undefined]);
  assert.deepEqual(G.settingsOf(h2h).rankMatchups, { playoffs: { teams: 2 } });
  assert.deepEqual(G.settingsOf(teams).rankTeams, { of: 2, score: "sum" });
  assert.deepEqual(G.settingsOf(handicap).rankHandicap, { points: 1 });
  assert.ok(G.poolByPoints(G.fullSpec(total)) && G.poolByPoints(G.fullSpec(h2h)) && !G.poolByPoints(G.fullSpec(POOL)));
  assert.deepEqual(G.matchupParts(G.fullSpec(h2h)), { odd: "median", quiet: "skip", playoffs: { teams: 2, rounds: 1, from: null } });
  assert.equal(G.teamParts(G.fullSpec(teams)).score, "sum");
  assert.deepEqual(G.handicapParts(G.fullSpec(handicap)), { points: 1, who: "new", newTo: "couch" });
  // With lives, a pool knocks players out: by its streak or last one standing, never by its points or head to head, nor its teams
  // or handicap (no place in the sequence: it waits, saying why).
  const lives = { lives: 2 };
  const waits = (spec) => G.specWaitsFor(spec).map((w) => w.problem);
  for (const rank of [{ by: "total" }, { by: "matchups" }]) {
    assert.match(waits(pool(rank, lives))[0], /^No game plays this way yet: a pool with lives knocks players out, so it ranks by its streak or last one standing/);
    assert.equal(G.typeOf(pool(rank, lives)), null);
  }
  assert.deepEqual(at(pool({ by: "matchups" }, lives)), ["rank.by"]);
  assert.deepEqual(at(pool({ by: "total", teams: { of: 2 } }, lives)), ["rank.teams"]);
  assert.deepEqual(at(pool({ by: "total", handicap: { points: 1 } }, lives)), ["rank.handicap"]);
  assert.equal(G.teamParts(G.fullSpec(pool({ by: "total", teams: { of: 2 } }, lives))), null);
  // On its streak or who's still standing, teams and a handicap stay refused (a streak is one person's; a handicap would only break
  // ties); a mulligan has nothing to forgive ranked by points, and a right pick has to be worth something.
  assert.deepEqual(at(pool({ by: "streak", teams: { of: 2 } })), ["rank.teams"]);
  assert.deepEqual(at(pool({ by: "streak", handicap: { points: 1 } })), ["rank.handicap"]);
  assert.match(G.specProblems(pool({ by: "streak", handicap: { points: 1 } }), CTX)[0].problem, /only break ties/);
  assert.deepEqual(at(pool({ by: "total" }, { mulligans: 1 })), ["score.mulligans"]);
  assert.deepEqual(at(pool({ by: "matchups" }, { points: 0 })), ["score.points"]);
  assert.deepEqual(at(pool({ by: "streak" }, { mulligans: 1 })), [], "a streak's mulligan");
  // A race and cuts are a draft's or a game of questions': a pool knocks players out with its lives.
  assert.deepEqual(at(pool({ by: "total", race: { to: 5 } })), ["rank.race"]);
  assert.equal(G.typeOf(pool({ by: "total", race: { to: 5 } })), null);
  // The words.
  const said = (spec) => G.describeSpec(spec, WORDS);
  assert.equal(said(total).sentence, "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, all season. A point for each right pick. Most points wins.");
  assert.equal(said(h2h).sentence, "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, all season. A point for each right pick. Each episode you play one of the others head to head: more points wins it. The top two by wins make the playoffs, over the last episode.");
  assert.equal(said(teams).sentence, "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, all season. A point for each right pick. Played in two teams, drawn at random at the start: a team's points are its members' added up.");
  assert.equal(said(handicap).sentence, "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, all season. A point for each right pick. Newcomers get 1 point an episode: anyone with no game on this couch from an earlier season. Most points wins.");
  assert.equal(said(pool({ by: "total" }, { points: 2 })).sentence.includes("2 points for each right pick. Most points wins."), true);
  const how = said(h2h).rules;
  assert.ok(how.includes("Right: you score a point. Wrong, or no pick: nothing."), how.join(" | "));
  assert.ok(how.includes("An episode's matchups are settled once it's known who went home."), how.join(" | "));
  assert.ok(!how.some((r) => /streak/.test(r)), "no streak in a pool ranked by its points");
  assert.ok(said(teams).rules.includes("The team with the most points wins: everyone on it shares the win."));
  assert.ok(said(total).rules.includes("Most points wins."));
});

test("the series: each episode the pool has decided, every seat's points through it; the table its last entry, ranked by points", () => {
  const s = season(league(pool({ by: "total" })));
  assert.deepEqual(seriesOf(s), EXPECTED);
  // Its last entry is the table's total, ranked by its points (a tie in the order they joined).
  const rows = S.computeScores(s);
  assert.deepEqual(rows.map((r) => [r.playerId, r.total]), [["ann", 4], ["cy", 4], ["bo", 3], ["di", 2]]);
  assert.deepEqual(rows.map((r) => S.rankKey(s, r)), [[4], [4], [3], [2]]);
  // The Games tab's table (game-view.ts tableOf): its number the points, its week the latest decided episode's (Episode 5: ann and
  // cy right, bo and di wrong); a streak pool's, its streak and the current one.
  const path = require("path");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  assert.deepEqual(tableOf(s, "ann", () => null).map((r) => [r.playerId, r.total, r.week, r.rank]), [["ann", 4, 1, "T1"], ["cy", 4, 1, "T1"], ["bo", 3, 0, "3"], ["di", 2, 0, "4"]]);
  // A streak pool on the same picks ranks by its streak (ann's 3, Episodes 1 to 3; cy's 3, 3 to 5; bo's 3, 2 to 4; di's misses in 1
  // and 3 keep hers to 1), its points the tie.
  const streak = season(league(POOL));
  assert.deepEqual(S.computeScores(streak).map((r) => [r.playerId, r.longestStreak, r.total]), [["ann", 3, 4], ["cy", 3, 4], ["bo", 3, 3], ["di", 1, 2]]);
  // Nothing before its decided episodes, and a pick for an episode still to air counts nothing (Episode 6: picked, not decided).
  picks(s, 6, { ann: 4 });
  assert.deepEqual(seriesOf(s), EXPECTED);
  // A second pick that counts, its points in the night's; a buyback's cost is taken off (its own test: pool-parts.test.js).
  const two = league(pool({ by: "total" }, {}, { second: { fallback: "counts" } }), ["ann", "bo"]);
  picks(two, 1, { ann: [0, 1], bo: [9, 2] });
  gone(two, 1, 9);
  assert.deepEqual(seriesOf(two).map((x) => x.slice(0, 4)), [[1, false, 2, 1]]);
  assert.deepEqual(S.computeScores(two).map((r) => [r.playerId, r.total]), [["ann", 2], ["bo", 1]]);
});

test("head to head on a pool: each episode on what its pick earned; the playoffs; nobody picks after the final", () => {
  // Episode by episode (the round robin: ann-di, bo-cy; ann-cy, di-bo; ann-bo, cy-di; ann-di, bo-cy; ann-cy, di-bo):
  //   1: ann 1 di 0 (ann), bo 0 cy 1 (cy)    2: ann 1 cy 0 (ann), di 1 bo 1 (tie)    3: ann 1 bo 1 (tie), cy 1 di 0 (cy)
  //   4: ann 0 di 1 (di), bo 1 cy 1 (tie)     5: ann 1 cy 1 (tie), di 0 bo 0 (tie: others scored, so it isn't a quiet night)
  const s = season(league(pool({ by: "matchups" })));
  const w = S.MatchupLogic.run(s);
  assert.deepEqual(w.weeks.map((x) => x.games.map((g) => [g.a, g.b, g.aPoints, g.bPoints, g.result])), [
    [["ann", "di", 1, 0, "a"], ["bo", "cy", 0, 1, "b"]],
    [["ann", "cy", 1, 0, "a"], ["di", "bo", 1, 1, "tie"]],
    [["ann", "bo", 1, 1, "tie"], ["cy", "di", 1, 0, "a"]],
    [["ann", "di", 0, 1, "b"], ["bo", "cy", 1, 1, "tie"]],
    [["ann", "cy", 1, 1, "tie"], ["di", "bo", 0, 0, "tie"]],
  ]);
  const rec = (p) => { const r = w.records.get(p); return [r.wins, r.losses, r.ties, r.for, r.against]; };
  assert.deepEqual(["ann", "bo", "cy", "di"].map(rec), [[2, 1, 2, 4, 3], [0, 1, 4, 3, 4], [2, 1, 2, 4, 3], [1, 2, 2, 2, 3]]);
  // The table: the most wins (a tie half), then the points; ann and cy level on both, in the order they joined.
  const rows = S.computeScores(s);
  assert.deepEqual(rows.map((r) => [r.playerId, r.matchups.wins, r.matchups.ties, r.total]), [["ann", 2, 2, 4], ["cy", 2, 2, 4], ["bo", 0, 4, 3], ["di", 1, 2, 2]]);

  // The playoffs, the top two from Episode 5: seeded on Episodes 1 to 4 (ann 2-1-1 with 3 points, cy 2-1-1 with 3: ann first, as
  // she joined first; bo 0-1-3, di 1-2-1), the final ann 1, cy 1: a tie goes to the better seed, ann. The game ends there.
  const po = season(league(pool({ by: "matchups", playoffs: { teams: 2, from: 5 } })));
  const pw = S.MatchupLogic.run(po);
  assert.deepEqual(pw.seeds, ["ann", "cy"]);
  assert.deepEqual(pw.rounds.map((r) => r.games.map((g) => [g.a, g.b, g.aPoints, g.bPoints, g.winner])), [[["ann", "cy", 1, 1, "ann"]]]);
  assert.equal(pw.champion, "ann");
  assert.deepEqual([S.lastEpisode(po), S.MatchupLogic.endsAt(po)], [5, 5]);
  // After the final nobody picks: the pick route's write does nothing (as for any pick refused), and Episode 6's results change
  // nothing (the game scores as it stood at its final).
  const e6 = S.pickEmEligibility(po, ep(po, 6).id, "bo");
  assert.deepEqual([e6.available, e6.ended], [[], 5]);
  picks(po, 6, { bo: 4 });
  assert.equal(S.pickEmPickFor(po, ep(po, 6).id, "bo"), null);
  const before = JSON.stringify(S.computeScores(po));
  gone(po, 6, 5);
  assert.equal(JSON.stringify(S.computeScores(po)), before);
  assert.equal(S.gameOver(po), true);
  // A streak pool on the same season: no end before its span's, picks open.
  assert.equal(S.pickEmEligibility(season(league(POOL)), ep(po, 6).id, "bo").ended, undefined);
});

test("teams of players on a pool: each team's points its members' (summed or the mean); head to head between them", () => {
  const kept = (s) => {
    s.teamSeats = { ann: [{ team: "t1", from: 1 }], cy: [{ team: "t1", from: 1 }], bo: [{ team: "t2", from: 1 }], di: [{ team: "t2", from: 1 }] };
    s.teamDraw = { seed: "zt-teams", kept: true };
    return s;
  };
  // Summed: t1 (ann, cy) 2 3 5 6 8, t2 (bo, di) 0 2 3 5 5.
  const sum = season(kept(league(pool({ by: "total", teams: { of: 2, made: "choose", score: "sum" } }))));
  assert.deepEqual(S.TeamLogic.series(sum).map((x) => [x.number, x.totals.get("t1"), x.totals.get("t2")]), [[1, 2, 0], [2, 3, 2], [3, 5, 3], [4, 6, 5], [5, 8, 5]]);
  const rows = S.computeScores(sum);
  assert.deepEqual(rows.map((r) => [r.playerId, r.team.id, r.team.points, r.team.place]), [["ann", "t1", 8, 1], ["cy", "t1", 8, 1], ["bo", "t2", 5, 2], ["di", "t2", 5, 2]]);
  assert.equal("out" in rows[0].team, false, "nobody's knocked out: a team's read as before");
  // By the mean: t1 4, t2 2.5.
  const mean = season(kept(league(pool({ by: "total", teams: { of: 2, made: "choose" } }))));
  assert.deepEqual(S.TeamLogic.standings(mean, S.computeScores(mean)).map((t) => [t.id, t.points]), [["t1", 4], ["t2", 2.5]]);
  // Head to head between them (the mean each episode: t1 1 0.5 1 0.5 1, t2 0 1 0.5 1 0): t1 wins 1, 3 and 5.
  const h2h = season(kept(league(pool({ by: "matchups", teams: { of: 2, made: "choose" } }))));
  const w = S.MatchupLogic.run(h2h);
  assert.deepEqual(w.weeks.map((x) => x.games.map((g) => [g.a, g.b, g.aPoints, g.bPoints, g.result])[0]), [["t1", "t2", 1, 0, "a"], ["t1", "t2", 0.5, 1, "b"], ["t1", "t2", 1, 0.5, "a"], ["t1", "t2", 0.5, 1, "b"], ["t1", "t2", 1, 0, "a"]]);
  assert.deepEqual(S.computeScores(h2h).map((r) => [r.playerId, r.matchups.wins, r.matchups.losses]), [["ann", 3, 2], ["cy", 3, 2], ["bo", 2, 3], ["di", 2, 3]]);
});

test("a handicap on a pool ranked by its points: a point each decided episode for each newcomer, in the series and the table", () => {
  // bo and di are new to the couch: 5 decided episodes, 5 points each (bo 3 + 5 = 8, di 2 + 5 = 7).
  const s = season(league(pool({ by: "total", handicap: { points: 1 } })));
  s.seatHistory = { ann: { couch: 2, show: 1 }, bo: { couch: 0, show: 0 }, cy: { couch: 1, show: 0 }, di: { couch: 0, show: 0 } };
  assert.deepEqual(seriesOf(s), [[1, false, 1, 1, 1, 1], [2, false, 2, 3, 1, 3], [3, true, 3, 5, 2, 4], [4, false, 3, 7, 3, 6], [5, false, 4, 8, 4, 7]]);
  assert.deepEqual(S.computeScores(s).map((r) => [r.playerId, r.handicap, r.total]), [["bo", 5, 8], ["di", 5, 7], ["ann", 0, 4], ["cy", 0, 4]]);
  // An episode with moments but nobody home yet isn't decided: no handicap for it (Episode 6's immunity, before its vote).
  ep(s, 6).scoringEvents = [{ id: "m6", type: "individualImmunity", castawayId: cid(s, 0) }];
  assert.deepEqual(S.HandicapLogic.played(s), [1, 2, 3, 4, 5]);
  assert.equal(S.computeScores(s).find((r) => r.playerId === "bo").handicap, 5);
});
