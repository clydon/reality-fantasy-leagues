// Teams of players knocked out, and a race between teams (docs/PLAN-start-a-game-gpt.md track C, C2 part 4b: the week's result on a
// team's totals). A draft's cuts and race walked over the teams' series (KnockoutLogic.teamWalk: TeamLogic.series over the seats'),
// each team's out every seat's that plays for it, so who's out, their moves, their points frozen there and an exclusive draft's
// castaways back in the pool stay per seat; the table ranks the teams last team standing (in before out, out later first, then
// points) or, in a race, by their points; nobody new joins or moves onto a team that's out. A game of questions' teams stay
// unknocked (its walk works each night's points out from who's out so far, seat by seat). Their shape, words and settings, on one
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
const SEATS = ["ann", "bo", "cy", "di", "ed", "fy"];
const TEAMS = { ann: "t1", bo: "t1", cy: "t2", di: "t2", ed: "t3", fy: "t3" };
/** Best ball of two (both count, no lineups to set), a point a moment, in three chosen teams summed. */
const lineup = (rank) => ({
  preset: "weekly-lineup",
  get: { by: "draft", each: 2, order: "snake", own: "exclusive" },
  count: { best: 2 },
  score: { by: "moments", points: { individualImmunity: 1 } },
  rank: { ...rank, teams: { of: 3, made: "choose", score: "sum", ...(rank.teams || {}) } },
});
/**
 * Each seat drafts two (seat i: c(2i) and c(2i+1)); c12 to c15 are free, one going home each episode. Each seat's points, by
 * episode (its first castaway's moments):
 *   ann 3 0 1 2   bo 1 2 0 2   cy 2 1 3 0   di 0 1 2 0   ed 1 0 5 1   fy 1 0 5 0
 * Through each: ann 3 3 4 6, bo 1 3 3 5, cy 2 3 6 6, di 0 1 3 3, ed 1 1 6 7, fy 1 1 6 6.
 * The teams summed (t1 ann + bo, t2 cy + di, t3 ed + fy): t1 4 6 7 11, t2 2 4 9 9, t3 2 2 12 13.
 */
const POINTS = { ann: [3, 0, 1, 2], bo: [1, 2, 0, 2], cy: [2, 1, 3, 0], di: [0, 1, 2, 0], ed: [1, 0, 5, 1], fy: [1, 0, 5, 0] };
function league(spec) {
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor", setupComplete: true },
    players: SEATS.map((id) => ({ id, name: id, color: "#000" })),
    draftOrder: SEATS.slice(),
    tribes: [{ id: "t1", name: "Toka", color: "#111" }],
    castaways: Array.from({ length: 16 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, status: "active", tribeId: "t1", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: Array.from({ length: 5 }, (_, i) => ({ id: `e${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  SEATS.forEach((p, i) => [2 * i, 2 * i + 1].forEach((k) => { s.castaways[k].ownerIds.push(p); s.castaways[k].acquiredVia = "draft"; }));
  s.teamSeats = Object.fromEntries(SEATS.map((p) => [p, [{ team: TEAMS[p], from: 1 }]]));
  s.teamDraw = { seed: "zt-teams", kept: true };
  for (let n = 1; n <= 4; n++) {
    const ep = s.episodes[n - 1];
    SEATS.forEach((p, i) => { if (POINTS[p][n - 1]) ep.scoringEvents.push({ id: `m${n}-${p}`, type: "individualImmunity", castawayId: `c${2 * i}`, units: POINTS[p][n - 1] }); });
    S.EpisodeLogic.addElimination(s, ep.id, `c${11 + n}`, "Voted Out");
  }
  return s;
}
const teamsOf = (rows) => rows.map((r) => [r.playerId, r.out, r.total, r.team && r.team.id, r.team && r.team.points, r.team && r.team.out, r.team && r.team.place]);

test("teams knocked out and a race between teams: their shape, words and settings; a game of questions' refused", () => {
  const at = (spec) => ats(G.specProblems(spec, CTX));
  const cut = lineup({ by: "standing", cut: [{ at: { episode: 2 }, out: 1 }] });
  const race = lineup({ by: "total", race: { to: 10 } });
  const outlast = { preset: "outlast", rank: { by: "standing", cut: [{ at: { every: 2 }, out: 1 }], teams: { of: 2 } } };
  for (const s of [cut, race, outlast, lineup({ by: "standing", cut: [{ at: { every: 1 }, out: 1 }], race: { to: 30 } })]) {
    assert.deepEqual(at(s), [], JSON.stringify(s.rank));
    assert.deepEqual(G.specWaitsFor(s), []);
    assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...G.settingsOf(s) }), G.fullSpec(s)), JSON.stringify(s.rank));
  }
  assert.equal(G.typeOf(cut), "active-roster");
  assert.equal(G.typeOf(outlast), "classic-draft");
  assert.deepEqual(G.knockoutParts(G.fullSpec(cut)).cuts, [{ at: { episode: 2 }, out: 1, tie: "keep", quiet: "cut" }]);
  assert.equal(G.teamParts(G.fullSpec(cut)).of, 3);
  assert.equal(G.teamParts(G.fullSpec(race)).of, 3);
  // Last team standing needs cuts; a game of questions' teams aren't knocked out nor raced (its walk is seat by seat).
  assert.deepEqual(at(lineup({ by: "standing" })), ["rank.by", "rank.teams"]);
  const asks = { get: { by: "none" }, count: null, score: { by: "answers" }, ask: [{ id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } }] };
  assert.deepEqual(at({ ...asks, rank: { by: "standing", cut: [{ at: { every: 1 } }], teams: { of: 2 } } }), ["rank.teams"]);
  assert.deepEqual(at({ ...asks, rank: { by: "total", race: { to: 20 }, teams: { of: 2 } } }), ["rank.teams"]);
  // The words: the teams first, then how they're knocked out or race.
  const W = { show: "Survivor 51", castaway: "castaway" };
  assert.equal(G.describeSpec(cut, W).sentence, "A game for Survivor 51: everyone drafts 2, and their best 2 count each episode, all season. Scored by Survivor 51's rules, with the game's own points. Played in three teams, each of you picking yours before it starts: a team's points are its members' added up. After Episode 2 the lowest team on points is cut. Last team standing wins.");
  assert.equal(G.describeSpec(race, W).sentence.endsWith("Played in three teams, each of you picking yours before it starts: a team's points are its members' added up. The first team to 10 points wins: the game ends there."), true);
  assert.match(G.describeSpec(lineup({ by: "standing", cut: [{ at: { every: 1 }, out: 2 }] }), W).sentence, /Each episode the two lowest-scoring teams are out\./);
  const how = G.describeSpec(cut, W).rules;
  for (const line of [
    "After Episode 2 the lowest team on points is cut. Tied at the line, no team tied there goes.",
    "Once your team is out, everyone on it scores nothing more and makes no more moves: its points stay where they were. Its castaways go back in the pool for everyone else.",
    "Last team standing wins: whichever's still in by its points, then whichever went out last. Once one team is left, it's over.",
  ]) assert.ok(how.includes(line), `${line}\n${how.join("\n")}`);
  assert.ok(!how.some((r) => /The team with the most points wins/.test(r)), "the knockouts say who wins");
  assert.ok(G.describeSpec(race, W).rules.some((r) => r.startsWith("The first team to 10 points wins: the game ends after that episode")));
});

test("teams knocked out: a cut on the teams' totals takes a whole team, its points (and its members') frozen there", () => {
  const s = league(lineup({ by: "standing", cut: [{ at: { episode: 2 }, out: 1 }] }));
  // The teams' series is the knockouts' walk: after Episode 2, t3 (2) is the lowest, so ed and fy are out there, their 1 each frozen,
  // and add nothing after (t3 keeps its 2; their 10 and 6 after count for nobody). t1 (11) and t2 (9) play on to the end: last team
  // standing, in before out.
  assert.deepEqual(S.TeamLogic.series(s).map((x) => [x.number, ...["t1", "t2", "t3"].map((t) => x.totals.get(t))]), [[1, 4, 2, 2], [2, 6, 4, 2], [3, 7, 9, 2], [4, 11, 9, 2]]);
  const k = S.KnockoutLogic.run(s);
  assert.deepEqual([...k.teams.out], [["t3", 2]]);
  assert.deepEqual([...k.out].sort(), [["ed", 2], ["fy", 2]]);
  assert.equal(k.ends, null);
  assert.deepEqual(teamsOf(S.computeScores(s)), [
    ["ann", null, 6, "t1", 11, null, 1], ["bo", null, 5, "t1", 11, null, 1],
    ["cy", null, 6, "t2", 9, null, 2], ["di", null, 3, "t2", 9, null, 2],
    ["ed", 2, 1, "t3", 2, 2, 3], ["fy", 2, 1, "t3", 2, 2, 3],
  ]);
  assert.deepEqual(S.TeamLogic.view(s, "ed").teams.map((t) => [t.id, t.points, t.out, t.rank]), [["t1", 11, null, "1"], ["t2", 9, null, "2"], ["t3", 2, 2, "3"]]);
  // Per seat as ever: out, no moves, their castaways back in the pool (an exclusive draft), nobody new.
  assert.equal(S.KnockoutLogic.isOut(s, "ed"), true);
  assert.equal(S.KnockoutLogic.moveProblem(s, "fy", 3), "You’re out of this game");
  assert.equal(S.KnockoutLogic.moveProblem(s, "ann", 3), null);
  assert.deepEqual(S.RosterLogic.freeAgents(s).map((c) => c.id).filter((id) => ["c8", "c9", "c10", "c11"].includes(id)).sort(), ["c10", "c11", "c8", "c9"]);
  assert.equal(S.GhostLogic.someoneOut(s), true, "nobody new once a team's out");
  // Nobody moves onto a team that's out.
  assert.equal(S.TeamLogic.chooseProblem(s, "ann", "t3", { by: "runs" }), "That team is out of the game");
  // Before the cut nobody's out: at Episode 1, the table is the teams' points (t1 4; t2 and t3 2 each, sharing second), members of
  // teams level by their own points.
  const one = S.GhostLogic.viewFor(JSON.parse(JSON.stringify(s)), null, 1);
  assert.deepEqual(S.computeScores(one).map((r) => [r.playerId, r.team.points, r.team.rank]), [["ann", 4, "1"], ["bo", 4, "1"], ["cy", 2, "T2"], ["ed", 2, "T2"], ["fy", 2, "T2"], ["di", 2, "T2"]]);
});

test("the guillotine on teams: a tie at the line keeps them, one team left ends it", () => {
  // Each episode the lowest over it: 1, t2 and t3 tied on 2 (and on 2 in all): nobody goes; 2, t3 (0) out; 3, t1 (1, to t2's 5) out:
  // one team left, it's over after Episode 3. The table as it stood then: t2 9 in, t1 out at 3 with 7, t3 out at 2 with 2.
  const s = league(lineup({ by: "standing", cut: [{ at: { every: 1 }, out: 1 }] }));
  const k = S.KnockoutLogic.run(s);
  assert.deepEqual([...k.teams.out], [["t3", 2], ["t1", 3]]);
  assert.equal(k.ends, 3);
  assert.deepEqual([S.lastEpisode(s), S.gameOver(s)], [3, true]);
  assert.deepEqual(teamsOf(S.computeScores(s)), [
    ["cy", null, 6, "t2", 9, null, 1], ["di", null, 3, "t2", 9, null, 1],
    ["ann", 3, 4, "t1", 7, 3, 2], ["bo", 3, 3, "t1", 7, 3, 2],
    ["ed", 2, 1, "t3", 2, 2, 3], ["fy", 2, 1, "t3", 2, 2, 3],
  ]);
  assert.equal(S.KnockoutLogic.moveProblem(s, "cy", 4), "This game ended with episode 3");
});

test("a race between teams: the first team to the line ends it after that episode, ranked by the teams' points", () => {
  // To 10, summed: t3's 12 after Episode 3 gets there first (t1 7, t2 9). Over there, as it stood then.
  const s = league(lineup({ by: "total", race: { to: 10 } }));
  const k = S.KnockoutLogic.run(s);
  assert.deepEqual([k.ends, k.out.size, k.teams.out.size], [3, 0, 0]);
  assert.deepEqual([S.lastEpisode(s), S.gameOver(s)], [3, true]);
  assert.deepEqual(teamsOf(S.computeScores(s)), [
    ["ed", null, 6, "t3", 12, null, 1], ["fy", null, 6, "t3", 12, null, 1],
    ["cy", null, 6, "t2", 9, null, 2], ["di", null, 3, "t2", 9, null, 2],
    ["ann", null, 4, "t1", 7, null, 3], ["bo", null, 3, "t1", 7, null, 3],
  ]);
  // By the mean (t3 6 after Episode 3, t1 5.5 at the end), nobody reaches 10: it plays to its end, the most points winning.
  const mean = league(lineup({ by: "total", race: { to: 10 }, teams: { score: "mean" } }));
  assert.equal(S.KnockoutLogic.run(mean).ends, null);
  assert.deepEqual(S.TeamLogic.standings(mean, S.computeScores(mean)).map((t) => [t.id, t.points, t.out]), [["t3", 6.5, null], ["t1", 5.5, null], ["t2", 4.5, null]]);
  // A team nobody's on is in no race and no cut (a team of three, nobody on t3): two teams, t2 lowest after Episode 2.
  const two = league(lineup({ by: "standing", cut: [{ at: { episode: 2 }, out: 1 }] }));
  two.teamSeats.ed = [{ team: "t1", from: 1 }];
  two.teamSeats.fy = [{ team: "t2", from: 1 }];
  const k2 = S.KnockoutLogic.run(two);
  assert.deepEqual([k2.teams.sides, [...k2.teams.out], k2.ends], [["t1", "t2"], [["t2", 2]], 2]);
  assert.deepEqual(S.TeamLogic.standings(S.spanView(two), S.computeScores(two)).map((t) => [t.id, t.points, t.out, t.place]), [["t1", 7, null, 1], ["t2", 5, 2, 2], ["t3", 0, null, 3]]);
});

test("a team everyone has left is in no walk; a seat moved for a later episode goes out with the team it played for", () => {
  // fy and ed leave the game (disabled, off t3 from Episode 3): as a seat that left is in no walk, t3 plays no episode, so the cut
  // after Episode 2 takes t2 (4, to t1's 6) instead, and with one team left playing it's over there.
  const left = league(lineup({ by: "standing", cut: [{ at: { episode: 2 }, out: 1 }] }));
  for (const p of left.players) if (p.id === "ed" || p.id === "fy") { p.disabled = true; left.teamSeats[p.id] = [{ team: "t3", from: 1 }, { team: null, from: 3, left: "t3" }]; }
  const k = S.KnockoutLogic.run(left);
  assert.deepEqual([k.teams.sides, [...k.teams.out], k.ends], [["t1", "t2", "t3"], [["t2", 2]], 2]);
  // Everyone moved off a team (nobody left the game): it plays no episode they're off it, so a cut then can't take it.
  const empty = league(lineup({ by: "standing", cut: [{ at: { episode: 2 }, out: 1 }], oneLeft: "plays" }));
  empty.teamSeats.ed = [{ team: "t3", from: 1 }, { team: "t1", from: 2 }];
  empty.teamSeats.fy = [{ team: "t3", from: 1 }, { team: "t2", from: 2 }];
  // After 2: t1 (ann, bo, ed from 2) 4 + 2 = 6, t2 (cy, di, fy from 2) 2 + 2 = 4, t3 (Episode 1 only) 2, not playing: t2 out.
  assert.deepEqual([...S.KnockoutLogic.run(empty).teams.out], [["t2", 2]]);
  // di moved from t2 to t1 from Episode 3: t3 goes after 2 (ed, fy), and di plays Episode 3 for t1, so the cut after 3 takes t2 (cy).
  const moved = league(lineup({ by: "standing", cut: [{ at: { episode: 2 }, out: 1 }, { at: { episode: 3 }, out: 1 }] }));
  moved.teamSeats.di = [{ team: "t2", from: 1 }, { team: "t1", from: 3 }];
  const m = S.KnockoutLogic.run(moved);
  // After 2: t1 6, t2 4, t3 2: t3 out (ed, fy). Episode 3: t1 6 + 1 (ann) + 0 (bo) + 2 (di) = 9, t2 4 + 3 (cy) = 7: t2 out after 3.
  assert.deepEqual([...m.teams.out], [["t3", 2], ["t2", 3]]);
  assert.deepEqual([...m.out].sort(), [["cy", 3], ["ed", 2], ["fy", 2]], "di was on t1 at 3: not out with t2");
  assert.equal(m.teams.walked.find((x) => x.number === 3).totals.get("t1"), 9);
  // The other way: di on t2 through 2, moved to t1 from 3, and t2 cut after 2: di goes out with t2, adding nothing to t1 after.
  const before = league(lineup({ by: "standing", cut: [{ at: { episode: 2 }, out: 1 }] }));
  before.teamSeats.ed = [{ team: "t2", from: 1 }];
  before.teamSeats.fy = [{ team: "t2", from: 1 }];
  before.teamSeats.di = [{ team: "t3", from: 1 }, { team: "t1", from: 3 }];
  // t1 (ann, bo) 4 6; t2 (cy, ed, fy) 4 5; t3 (di) 0 1: t3 out after 2 with di on it; di's Episode 3 (2) counts for nobody.
  const b = S.KnockoutLogic.run(before);
  assert.deepEqual([[...b.teams.out], b.out.get("di")], [[["t3", 2]], 2]);
  assert.equal(b.teams.walked.find((x) => x.number === 3).totals.get("t1"), 7, "t1 6 + ann's 1 + bo's 0, not di's 2");
  assert.equal(S.TeamLogic.series(before).find((x) => x.number === 3).totals.get("t1"), 7, "the teams' series is the walk's");
});
