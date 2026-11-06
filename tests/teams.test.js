// Teams of players (docs/PLAN-start-a-game-gpt.md step A11 part 5: the dial who.teams, "teams"): rank.teams, the couch split into
// teams that score together, each of you playing your own game (a draft's or a game of questions'), ranked by the teams' points
// or head to head between the teams. Their shape, defaults, words and settings; the engine (TeamLogic): the draw (seeded, balanced,
// kept once the game starts), the choosing (before the start, by the seat or whoever runs the game; moved after it from the next
// episode), a team's points (summed or their mean, episode by episode, of whoever was on it then), and each fallback (someone
// unplaced at the start, a late joiner, a ghost, someone catching up, a disabled seat and one reclaimed, results still early, a
// corrected result, a viewer behind, a team the spec no longer has, a tie); head to head between the teams; a game of questions'
// teams from its walk; the table, the couch's standings (one team in the field, teammates never in each other's head to head) and
// the trophy (the winning team's members, each credited). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const T = S.TeamLogic;
const ats = (problems) => problems.map((p) => p.at);
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: { exclusive: 3, shared: 4 }, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};
// The tracker's row (tests/fixtures/engine-capabilities.json), as its spec.
const WHO_TEAMS = { preset: "weekly-lineup", rank: { by: "total", teams: { of: 2 } } };
/** A best-ball draft of three each, exclusive, its rank `rank` (played in teams: `teams`). */
const best = (teams, rank = { by: "total" }, more = {}) => ({ preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null }, rank: { ...rank, teams }, ...more });
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };

test("teams of players: their shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX, opts) => ats(G.specProblems(spec, ctx, opts));
  const questions = { get: { by: "none" }, score: { by: "answers" }, ask: [BOOT], rank: { by: "total", teams: { of: 3, made: "choose", score: "sum", unplaced: "none", names: ["Red", "Blue", "Gold"] } } };
  const h2h = best({ of: 2 }, { by: "matchups", playoffs: { teams: 2 } }, { span: { from: 1, to: 6 } });
  for (const s of [WHO_TEAMS, best({ of: 2 }), questions, h2h, { preset: "outlast", get: { by: "draft", each: 3 }, rank: { teams: { of: 4 } } }]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specWaitsFor(s), []);
    // Back from the settings they write, whole.
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.equal(G.typeOf(WHO_TEAMS), "active-roster");
  assert.equal(G.typeOf(questions), "questions");
  assert.equal(G.flagsOf(G.fullSpec(WHO_TEAMS)).hasTeams, true);
  assert.equal(G.flagsOf(G.fullSpec({ preset: "weekly-lineup" })).hasTeams, false);
  // The defaults (the user's to set) are read, never filled in.
  assert.deepEqual(G.TEAMS, { made: "draw", score: "mean", unplaced: "smallest" });
  assert.deepEqual(G.fullSpec(WHO_TEAMS).rank, { by: "total", teams: { of: 2 } });
  assert.deepEqual(G.teamParts(G.fullSpec(WHO_TEAMS)), { of: 2, made: "draw", score: "mean", unplaced: "smallest", names: [null, null] });
  assert.deepEqual(G.teamParts(G.fullSpec(questions)), { of: 3, made: "choose", score: "sum", unplaced: "none", names: ["Red", "Blue", "Gold"] });
  assert.equal(G.teamParts(G.fullSpec({ preset: "weekly-lineup" })), null);
  // A game of questions in teams is walked (its points handed over episode by episode).
  assert.deepEqual(G.answerParts(G.fullSpec(questions)).teams, G.teamParts(G.fullSpec(questions)));
  // Its settings: rankTeams, a draft's and a game of questions'.
  assert.deepEqual(G.withSpec(S.defaultState().settings, WHO_TEAMS).rankTeams, { of: 2 });
  assert.equal(G.withSpec(S.defaultState().settings, { preset: "weekly-lineup" }).rankTeams, undefined);
  // Following the show's own groups (part 5c): refused, with what rides the show's groups instead; nothing plays it (never the
  // default's draw).
  const group = { preset: "weekly-lineup", rank: { by: "total", teams: { of: 2, made: "group" } } };
  assert.deepEqual(at(group), ["rank.teams.made"]);
  assert.match(G.specProblems(group, CTX)[0].problem, /last the game, while the show's groups end at a swap, a merge or a re-pairing: .*group slot/);
  assert.deepEqual(G.specWaitsFor(group), []);
  assert.equal(G.teamParts(G.fullSpec(group)), null);
  assert.equal(G.answerParts(G.fullSpec({ ...questions, rank: { by: "total", teams: { of: 2, made: "group" } } })), null);
  // Beside the wrong game, or out of range.
  assert.deepEqual(at({ preset: "survival-pool", rank: { teams: { of: 2 } } }), ["rank.teams"], "a pool's streak is one person's");
  assert.deepEqual(at({ preset: "weekly-calls", rank: { teams: { of: 2 } } }), ["rank.teams"], "Weekly Calls' calls are counted outside the game");
  assert.deepEqual(at({ preset: "weekly-bingo", rank: { teams: { of: 2 } } }), ["rank.teams"], "bingo lines too");
  const coop = { get: { by: "none" }, score: { by: "answers", lives: 3 }, ask: [BOOT], rank: { by: "coop", teams: { of: 2 } } };
  assert.deepEqual(at(coop), ["rank.teams"], "co-op is the whole couch on one side");
  assert.deepEqual(at(best({ of: 2 }, { by: "standing", cut: [{ at: { every: 1 } }] })), ["rank.teams"], "a team knocked out isn't built");
  assert.deepEqual(at(best({ of: 2 }, { by: "total", race: { to: 20 } })), ["rank.teams"], "nor a race between teams");
  for (const of of [1, 7, 2.5, "two"]) assert.deepEqual(at(best({ of })), ["rank.teams.of"], `of ${of}`);
  assert.deepEqual(at(best({ of: 2, made: "coin" })), ["rank.teams.made"]);
  assert.deepEqual(at(best({ of: 2, score: "max" })), ["rank.teams.score"]);
  assert.deepEqual(at(best({ of: 2, unplaced: "bench" })), ["rank.teams.unplaced"]);
  assert.deepEqual(at(best({ of: 2, names: ["A", "B", "C"] })), ["rank.teams.names"], "more names than teams");
  assert.deepEqual(at(best({ of: 2, names: ["Red", "red"] })), ["rank.teams.names"], "the same name twice");
  assert.deepEqual(at(best({ of: 2, names: ["A".repeat(25)] })), ["rank.teams.names"], "too long");
  assert.deepEqual(at(best({ of: 2, names: ["Red"] })), [], "fewer names than teams is fine");
  assert.deepEqual(at(best({ of: 2, seat: 1 })), ["rank.teams.seat"], "an unknown key");
  assert.deepEqual(at(best({ of: 2 }, { by: "matchups", playoffs: { teams: 4 } })), ["rank.playoffs.teams"], "the playoffs take teams");
  // With ctx: each team needs someone on it (seats, a shared one once); the playoffs count the teams, not the seats.
  assert.deepEqual(at(WHO_TEAMS, { ...CTX, couch: 1 }), ["rank.teams.of"]);
  assert.match(G.specProblems(WHO_TEAMS, { ...CTX, couch: 1 })[0].problem, /^1 of you can't fill 2 teams/);
  assert.deepEqual(at(best({ of: 3 }), { ...CTX, couch: 4, teams: 2 }), ["rank.teams.of"], "teams, not people (a shared seat)");
  assert.deepEqual(at(WHO_TEAMS, { ...CTX, couch: 2 }), []);
  assert.deepEqual(at(best({ of: 2 }, { by: "matchups", playoffs: { teams: 2 } }), { ...CTX, couch: 4 }), [], "the playoffs' two teams, of four seats");
  assert.deepEqual(at(WHO_TEAMS, { ...CTX, couch: 1 }, { league: true }), [], "a league's own keeps the teams it plays");
  // The words: the sentence and How it works.
  const d = (s) => G.describeSpec(s, { castaway: "castaway" });
  assert.match(d(WHO_TEAMS).sentence, /Played in two teams, drawn at random at the start: a team's points are its members' average\.$/);
  const rules = d(WHO_TEAMS).rules.join(" ");
  assert.match(rules, /The couch splits into two teams, drawn at random when the game starts\. Everyone still plays their own game\./);
  assert.match(rules, /the average of what its members earn in it, so a smaller team isn't behind/);
  assert.match(rules, /Join after the start and you go onto the smallest team, from the next episode\./);
  assert.match(rules, /The team with the most points wins: everyone on it shares the win\./);
  const q = d(questions);
  assert.match(q.sentence, /Played in three teams \(Red, Blue and Gold\), each of you picking yours before it starts: a team's points are its members' added up\.$/);
  assert.match(q.rules.join(" "), /^No draft\. Answer one question/);
  assert.match(q.rules.join(" "), /Don't pick a team by the start, or join after it, and you play on no team: your points count for nobody\./);
  assert.match(d(best({ of: 2, made: "choose" })).rules.join(" "), /Don't pick a team by the start and you go onto the smallest one; join after it and you go onto the smallest from the next episode\./);
  assert.doesNotMatch(q.rules.join(" "), /Most points wins\./);
  const h = d(h2h);
  assert.match(h.sentence, /Each episode your team plays another head to head: more points wins it\. The top two teams by wins make the playoffs, over the last episode\.$/);
  assert.match(h.rules.join(" "), /Each episode your team plays another head to head, every team in turn/);
  assert.doesNotMatch(h.rules.join(" "), /The team with the most points wins/);
});

// ---- the engine, on a league ----

const PLAYERS = ["ann", "bo", "cy", "di"];
/** A league of twelve castaways C0 to C11, the players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8, di C9-C11),
 *  its game `spec` through setGame; Episodes 1 to 10 made, none with results. */
function league(spec, players = PLAYERS) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 12; i++) S.addCastaway(s, `C${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = players[Math.floor(i / 3)] ? [players[Math.floor(i / 3)]] : []; });
  for (let n = 1; n <= 10; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
/** Episode n's points by player: 3 (immunity), 2 (an idol), 5 (both) or 0, on each one's first castaway. */
function points(s, n, by) {
  for (const [p, pts] of Object.entries(by)) {
    const i = PLAYERS.indexOf(p) * 3;
    if (pts === 3 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "individualImmunity", cid(s, i)));
    if (pts === 2 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "idolFound", cid(s, i)));
  }
}
/** Each player onto a team before the start (a chosen game): { player: team }. */
function choose(s, by) {
  for (const [p, t] of Object.entries(by)) assert.equal(T.chooseProblem(s, p, t), null, `${p} onto ${t}`), T.choose(s, p, t);
}
const rows = (s) => S.computeScores(s);
const teamOf = (s) => Object.fromEntries(rows(s).map((r) => [r.playerId, r.team ? r.team.id : null]));
const standing = (s) => Object.fromEntries(T.standings(s, rows(s)).map((t) => [t.id, t.points]));

test("the draw: balanced, seeded, the same on every read until the game starts, then kept; who's in it", () => {
  const s = league(best({ of: 2 }));
  // Made in teams (setGame), it has its draw's seed at once, so what it shows before the start is what it keeps.
  assert.match(s.teamDraw.seed, /^teams_/);
  assert.equal(T.settle(s), false, "nothing to keep before the start");
  assert.equal(s.teamSeats, undefined, "nothing kept before the start");
  // A state without a seed (settings written some other way) draws from a fixed one; a write's settle gives it its own.
  const bare = league(best({ of: 2 }));
  delete bare.teamDraw;
  assert.equal(T.drawn(bare).size, 4);
  assert.equal(T.settle(bare), true);
  assert.match(bare.teamDraw.seed, /^teams_/);
  const drawn = T.drawn(s);
  assert.deepEqual([...drawn.values()].sort(), ["t1", "t1", "t2", "t2"], "two and two");
  assert.deepEqual([...T.drawn(s)], [...drawn], "the same on every read");
  assert.equal(T.settle(s), false, "nothing more to keep before the start");
  // Five seats in three teams: two, two and one.
  const five = league(best({ of: 3 }), ["ann", "bo", "cy", "di", "ed"]);
  T.settle(five);
  const sizes = [...T.membersAt(five, 1).values()].map((m) => m.length).sort();
  assert.deepEqual(sizes, [1, 2, 2]);
  // A ghost, a late joiner and a disabled seat aren't dealt.
  const odd = league(best({ of: 2 }), ["ann", "bo", "cy", "di", "ed", "fy", "gu"]);
  odd.players[4].ghost = true;
  odd.players[5].lateJoin = { startEpisode: 4 };
  odd.players[6].disabled = true;
  assert.deepEqual([...T.drawn(odd).keys()].sort(), PLAYERS);
  // Started (its first episode has results): the draw kept as it stood, each from the start.
  points(s, 1, { ann: 5 });
  assert.equal(T.started(s), true);
  assert.equal(T.settle(s), true);
  assert.equal(s.teamDraw.kept, true);
  assert.deepEqual(Object.fromEntries(Object.entries(s.teamSeats).map(([p, sp]) => [p, sp])), Object.fromEntries([...drawn].map(([p, t]) => [p, [{ team: t, from: 1 }]])));
  // Kept for good: a new seed changes nothing.
  s.teamDraw.seed = "another";
  assert.deepEqual(teamOf(s), Object.fromEntries(drawn));
  // A lock without results starts it too (the first episode's air time passed).
  const locked = league(best({ of: 2 }));
  T.settle(locked);
  ep(locked, 1).airsAt = "2026-01-01T01:00:00Z";
  assert.equal(T.started(locked, Date.parse("2026-01-01T00:00:00Z")), false);
  assert.equal(T.started(locked, Date.parse("2026-01-01T02:00:00Z")), true);
  assert.equal(T.settle(locked, Date.parse("2026-01-01T02:00:00Z")), true);
  assert.equal(Object.keys(locked.teamSeats).length, 4);
  // A game made in teams once the season is under way keeps them at once, counting its past from each one's start.
  const late = league(best(undefined));
  points(late, 1, { ann: 5, bo: 3 });
  assert.deepEqual(S.setGame(late, best({ of: 2 }), { ctx: CTX }), []);
  T.settle(late);
  assert.ok(Object.values(late.teamSeats).every((sp) => sp[0].from === 1));
  assert.equal(T.standings(late, rows(late)).reduce((a, t) => a + t.points, 0), 4, "Episode 1's 8 points in two teams of two: 4 between their means");
  // Not played in teams any more: everything goes.
  assert.deepEqual(S.setGame(late, best(undefined), { ctx: CTX }), []);
  assert.equal(T.settle(late), true);
  assert.equal(late.teamSeats, undefined);
  assert.equal(late.teamDraw, undefined);
});

test("choosing: a seat picks before the start, whoever runs the game moves anyone after it from the next episode; the refusals", () => {
  const s = league(best({ of: 2, made: "choose" }));
  T.settle(s);
  choose(s, { ann: "t1", bo: "t1", cy: "t2" });
  assert.deepEqual(s.teamSeats.ann, [{ team: "t1", from: 1 }]);
  // Changing your mind before the start replaces it.
  T.choose(s, "bo", "t2");
  assert.deepEqual(s.teamSeats.bo, [{ team: "t2", from: 1 }]);
  assert.equal(T.chooseProblem(s, "ann", "t3"), "No such team");
  assert.equal(T.chooseProblem(s, "zed", "t1"), "No such player");
  // di didn't choose: at the start they go onto the smallest team (t1, with ann alone), ann still there.
  points(s, 1, { ann: 5, di: 3 });
  assert.equal(T.chooseProblem(s, "di", "t2"), "The teams are set: the game has started");
  T.settle(s);
  assert.deepEqual(teamOf(s), { ann: "t1", bo: "t2", cy: "t2", di: "t1" });
  assert.deepEqual(s.teamSeats.di, [{ team: "t1", from: 1 }], "from the start: Episode 1 counts");
  // Whoever runs the game moves bo onto t1 from the next episode: Episode 1's points stay with t2.
  assert.equal(T.chooseProblem(s, "bo", "t1", { by: "runs" }), null);
  assert.ok(T.choose(s, "bo", "t1", { by: "runs" }));
  assert.deepEqual(s.teamSeats.bo, [{ team: "t2", from: 1 }, { team: "t1", from: 2 }]);
  assert.equal(T.teamAt(s, "bo", 1), "t2");
  assert.equal(T.teamAt(s, "bo", 2), "t1");
  // Moved back before Episode 2 is played: as it was.
  T.choose(s, "bo", "t2", { by: "runs" });
  assert.deepEqual(s.teamSeats.bo, [{ team: "t2", from: 1 }]);
  // Episode 2 locked (in play, no results yet): a move counts from Episode 3, so nothing in play changes.
  ep(s, 2).lineupsLocked = true;
  assert.equal(T.openFor(s, "bo"), 3);
  T.choose(s, "bo", "t1", { by: "runs" });
  assert.deepEqual(s.teamSeats.bo, [{ team: "t2", from: 1 }, { team: "t1", from: 3 }]);
  T.choose(s, "bo", "t2", { by: "runs" });
  delete ep(s, 2).lineupsLocked;
  // A drawn game: nobody picks; whoever runs it moves people only once it's started.
  const d = league(best({ of: 2 }));
  T.settle(d);
  assert.equal(T.chooseProblem(d, "ann", "t1"), "The teams are drawn at the game's start");
  assert.match(T.chooseProblem(d, "ann", "t1", { by: "runs" }), /move someone once it has/);
  points(d, 1, { ann: 5 });
  T.settle(d);
  const other = T.teamAt(d, "ann", 1) === "t1" ? "t2" : "t1";
  assert.equal(T.chooseProblem(d, "ann", other, { by: "runs" }), null);
  // A ghost, someone catching up, a disabled seat, a game not in teams.
  const g = league(best({ of: 2, made: "choose" }), ["ann", "bo", "cy", "di", "ed", "fy"]);
  g.players[4].ghost = true;
  g.players[5].lateJoin = { startEpisode: 3, catchingUp: true };
  g.players[3].disabled = true;
  assert.match(T.chooseProblem(g, "ed", "t1"), /playing their own season/);
  assert.match(T.chooseProblem(g, "fy", "t1"), /still catching up/);
  assert.equal(T.chooseProblem(g, "di", "t1"), "They've left the game");
  assert.equal(T.chooseProblem(league(best(undefined)), "ann", "t1"), "This game isn't played in teams");
});

test("a team's points: its members' sum or their mean, episode by episode, of whoever was on it then; the table ranks the teams", () => {
  const spec = (score) => best({ of: 2, made: "choose", score });
  const sum = league(spec("sum"), ["ann", "bo", "cy"]);
  const mean = league(spec("mean"), ["ann", "bo", "cy"]);
  for (const s of [sum, mean]) {
    T.settle(s);
    choose(s, { ann: "t1", bo: "t1", cy: "t2" });
    points(s, 1, { ann: 5, bo: 3, cy: 5 });
    T.settle(s);
  }
  // Summed, ann and bo's 8 beat cy's 5; as their mean, 4 is behind cy's 5.
  assert.deepEqual(standing(sum), { t1: 8, t2: 5 });
  assert.deepEqual(standing(mean), { t2: 5, t1: 4 });
  // Every member shares their team's place, listed by their own points: the table's order.
  assert.deepEqual(rows(sum).map((r) => [r.playerId, r.team.place, r.total]), [["ann", 1, 5], ["bo", 1, 3], ["cy", 2, 5]]);
  assert.deepEqual(rows(mean).map((r) => [r.playerId, r.team.place]), [["cy", 1], ["ann", 2], ["bo", 2]]);
  const { tableOf, gameView } = jiti("../src/lib/game/game-view.ts");
  const table = tableOf(sum, "cy", () => null);
  assert.deepEqual(table.map((r) => [r.playerId, r.rank, r.side.id, r.side.rank, r.side.points]), [["ann", "T1", "t1", "1", 8], ["bo", "T1", "t1", "1", 8], ["cy", "3", "t2", "2", 5]]);
  const ref = { leagueId: "l", name: "L", gameType: "active-roster", gameName: "Weekly Lineup", yourRole: null };
  const v = gameView(ref, sum, "cy", null, () => null);
  assert.deepEqual(v.teams, { made: "choose", score: "sum", of: 2, set: true, yours: "t2", teams: [{ id: "t1", name: null, members: ["ann", "bo"], points: 8, place: 1, rank: "1" }, { id: "t2", name: null, members: ["cy"], points: 5, place: 2, rank: "2" }] });
  assert.equal(gameView(ref, sum, null, null, () => null).teams.yours, null, "no seat");
  // A game not in teams: no team on its rows, none in its view.
  const plain = league(best(undefined));
  points(plain, 1, { ann: 5 });
  assert.ok(rows(plain).every((r) => !("team" in r)));
  assert.equal(tableOf(plain, "ann", () => null)[0].side, null);
  assert.equal(gameView(ref, plain, "ann", null, () => null).teams, null);
  // A tie between teams: everyone shares first.
  points(sum, 2, { cy: 3 });
  assert.deepEqual(standing(sum), { t1: 8, t2: 8 });
  assert.ok(rows(sum).every((r) => r.team.place === 1 && r.team.rank === "T1"));
});

test("who's on a team over time: a late joiner, someone unplaced, a disabled seat and one reclaimed, a team the spec drops", () => {
  const s = league(best({ of: 2, made: "choose", score: "sum" }), ["ann", "bo", "cy", "di", "ed"]);
  // ed is a late joiner who starts at Episode 3 and isn't on the season yet: nobody places them until then. ed holds C11.
  s.players[4].lateJoin = { startEpisode: 3, catchingUp: true };
  s.castaways[11].ownerIds = ["ed"];
  T.settle(s);
  choose(s, { ann: "t1", bo: "t1", cy: "t2", di: "t2" });
  points(s, 1, { ann: 5, cy: 3 });
  points(s, 2, { bo: 2, di: 2 });
  T.settle(s);
  assert.equal(s.teamSeats.ed, undefined, "still catching up: on no team");
  assert.deepEqual(standing(s), { t1: 7, t2: 5 });
  // Caught up: onto the smallest team (both have two: the first), from the first episode still to play.
  delete s.players[4].lateJoin.catchingUp;
  T.settle(s);
  assert.deepEqual(s.teamSeats.ed, [{ team: "t1", from: 3 }]);
  // cy leaves the game after Episode 2: off t2 from Episode 3, their 3 still t2's.
  S.disablePlayer(s, "cy");
  T.settle(s);
  assert.deepEqual(s.teamSeats.cy, [{ team: "t2", from: 1 }, { team: null, from: 3, left: "t2" }]);
  points(s, 3, { cy: 5 });
  assert.ok(S.addScoringEvent(s, ep(s, 3).id, "idolFound", cid(s, 11)));
  assert.deepEqual(standing(s), { t1: 9, t2: 5 }, "cy's Episode 3 counts for nobody; ed's 2 for t1");
  // The row of someone who left still plays for the team they left (their place is its).
  assert.equal(rows(s).find((r) => r.playerId === "cy").team.id, "t2");
  assert.equal(rows(s).find((r) => r.playerId === "cy").team.now, false);
  // Reclaimed before Episode 4: back on t2 from 4.
  S.reclaimPlayer(s, "cy");
  T.settle(s);
  assert.deepEqual(s.teamSeats.cy.slice(-1), [{ team: "t2", from: 4 }]);
  points(s, 4, { cy: 3 });
  assert.deepEqual(standing(s), { t1: 9, t2: 8 });
  // Unplaced 'none': a late joiner plays for nobody, ranked after every team.
  const none = league(best({ of: 2, made: "choose", unplaced: "none" }), ["ann", "bo", "cy"]);
  T.settle(none);
  choose(none, { ann: "t1", bo: "t2" });
  points(none, 1, { cy: 5, ann: 3 });
  T.settle(none);
  assert.deepEqual(none.teamSeats.cy, [{ team: null, from: 1 }]);
  assert.deepEqual(rows(none).map((r) => [r.playerId, r.team ? r.team.id : null]), [["ann", "t1"], ["bo", "t2"], ["cy", null]], "cy's 5 ranks after both teams");
  // A team the spec no longer has: its seats are placed again, from the next episode.
  const three = league(best({ of: 3, made: "choose", score: "sum" }), ["ann", "bo", "cy"]);
  T.settle(three);
  choose(three, { ann: "t1", bo: "t2", cy: "t3" });
  points(three, 1, { cy: 5 });
  T.settle(three);
  assert.deepEqual(S.setGame(three, best({ of: 2, made: "choose", score: "sum" }), { ctx: CTX }), []);
  T.settle(three);
  assert.equal(T.teamAt(three, "cy", 1), null, "its Episode 1 was for a team there isn't now");
  assert.equal(T.teamAt(three, "cy", 2), "t1", "onto the smallest (a tie: the first)");
});

test("results still early, a corrected result and a viewer behind: worked out again on every read", () => {
  const s = league(best({ of: 2, made: "choose", score: "sum" }));
  T.settle(s);
  choose(s, { ann: "t1", bo: "t1", cy: "t2", di: "t2" });
  points(s, 1, { ann: 5, cy: 3 });
  points(s, 2, { bo: 3 });
  // Episode 2's results early: its points still count, on the teams as they are (the table's own points).
  S.EpisodeLogic.setResultsStage(s, ep(s, 2).id, "early");
  assert.deepEqual(standing(s), { t1: 8, t2: 3 });
  S.EpisodeLogic.setResultsStage(s, ep(s, 2).id, "final");
  // Episode 1's immunity was cy's, not ann's (ann keeps the idol): corrected.
  const imm = ep(s, 1).scoringEvents.find((e) => e.type === "individualImmunity" && e.castawayId === cid(s, 0));
  S.removeScoringEvent(s, ep(s, 1).id, imm.id);
  S.addScoringEvent(s, ep(s, 1).id, "individualImmunity", cid(s, 6));
  assert.deepEqual(standing(s), { t1: 5, t2: 6 });
  // Seen through Episode 1 only: Episode 2 isn't there.
  const behind = S.SpoilerLogic.viewThrough(s, 1);
  assert.deepEqual(Object.fromEntries(T.standings(behind, S.computeScores(behind)).map((t) => [t.id, t.points])), { t2: 6, t1: 2 });
});

test("head to head between teams: the teams play each other, every member sharing its record; the playoffs crown a team", () => {
  const s = league(best({ of: 2, made: "choose" }, { by: "matchups", playoffs: { teams: 2 } }, { span: { from: 1, to: 3 } }));
  T.settle(s);
  choose(s, { ann: "t1", bo: "t1", cy: "t2", di: "t2" });
  assert.deepEqual(S.MatchupLogic.seatsAt(s, 1), ["t1", "t2"], "the sides are the teams");
  // Episode 1: t1's mean (5 + 5) / 2 = 5 beats t2's (2 + 0) / 2 = 1; Episode 2: t2's 2.5 beats t1's 1.
  points(s, 1, { ann: 5, bo: 5, cy: 2 });
  points(s, 2, { bo: 2, cy: 5 });
  const rec = (st) => Object.fromEntries(S.computeScores(st).map((r) => [r.playerId, r.matchups ? `${r.matchups.wins}-${r.matchups.losses}-${r.matchups.ties}` : null]));
  assert.deepEqual(rec(s), { ann: "1-1-0", bo: "1-1-0", cy: "1-1-0", di: "1-1-0" });
  const m = S.computeScores(s).find((r) => r.playerId === "ann").matchups;
  assert.deepEqual([m.for, m.against], [6, 3.5]);
  // Level on wins, t1 seeded first on the regular season's points (6 to 3.5); the final at Episode 3.
  assert.deepEqual(S.MatchupLogic.run(s).seeds, ["t1", "t2"]);
  const { gameView } = jiti("../src/lib/game/game-view.ts");
  const ref = { leagueId: "l", name: "L", gameType: "active-roster", gameName: "Weekly Lineup", yourRole: null };
  const v = gameView(ref, s, "di", null, () => null).matchups;
  assert.equal(v.side, "t2");
  assert.deepEqual(v.next, { episode: 3, round: 1, opponent: "t1", stand: null });
  assert.deepEqual([v.last.episode, v.last.opponent, v.last.points, v.last.against, v.last.result], [2, "t1", 2.5, 1, "win"]);
  // The final: t2 wins it (1.5 to 0); both of t2's members are champions, first, though t1 has more points (6 to 5): the teams are
  // placed as head to head ranks them, on the table, its sides and the couch.
  points(s, 3, { di: 3 });
  assert.equal(S.MatchupLogic.run(s).champion, "t2");
  assert.deepEqual(S.computeScores(s).map((r) => [r.playerId, r.matchups.champion, r.team.place, r.team.points]), [["cy", true, 1, 5], ["di", true, 1, 5], ["bo", false, 2, 6], ["ann", false, 2, 6]]);
  assert.deepEqual(gameView(ref, s, "ann", null, () => null).teams.teams.map((t) => [t.id, t.place, t.points]), [["t2", 1, 5], ["t1", 2, 6]]);
  assert.equal(S.gameOver(s), true);
  // Three teams: an odd number, the one left out plays the median of the others.
  const odd = league(best({ of: 3, made: "choose" }, { by: "matchups" }), ["ann", "bo", "cy"]);
  T.settle(odd);
  choose(odd, { ann: "t1", bo: "t2", cy: "t3" });
  points(odd, 1, { ann: 3, bo: 5, cy: 2 });
  assert.deepEqual(rec(odd), { bo: "1-0-0", ann: "0-1-0", cy: "0-1-0" });
  // Someone on no team plays nobody.
  const lone = league(best({ of: 2, made: "choose", unplaced: "none" }, { by: "matchups" }), ["ann", "bo", "cy"]);
  T.settle(lone);
  choose(lone, { ann: "t1", bo: "t2" });
  points(lone, 1, { ann: 3, cy: 5 });
  T.settle(lone);
  assert.deepEqual(rec(lone), { ann: "1-0-0", bo: "0-1-0", cy: null });
  assert.equal(gameView(ref, lone, "cy", null, () => null).matchups.next, null);
});

test("a game of questions in teams: its points from the walk, episode by episode; the table from the walked copy", () => {
  const spec = { span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers" }, ask: [BOOT], rank: { by: "total", teams: { of: 2, made: "choose", score: "sum" } } };
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "questions");
  for (let i = 0; i < 8; i++) S.addCastaway(s, `C${i}`);
  s.players = PLAYERS.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  T.settle(s);
  choose(s, { ann: "t1", bo: "t1", cy: "t2", di: "t2" });
  const out = (n, i) => S.addElimination(s, S.ensureEpisodeNumber(s, n, false).id, cid(s, i), "Voted Out");
  out(1, 0);
  out(2, 1);
  const said = (n, by) => Object.entries(by).map(([playerId, i]) => ({ playerId, question: "boot", episode: n, answer: cid(s, i) }));
  const answers = [...said(1, { ann: 0, bo: 0, cy: 0, di: 3 }), ...said(2, { ann: 2, bo: 3, cy: 1, di: 1 })];
  const w = S.AnswerLogic.walk(s, answers, S.AnswerLogic.facts(s));
  assert.deepEqual(w.series.map((x) => x.number), [1, 2], "the walk hands its episodes over");
  const v = S.AnswerLogic.withWalk(s, w);
  assert.deepEqual(Object.fromEntries(T.standings(v, S.computeScores(v)).map((t) => [t.id, t.points])), { t1: 2, t2: 3 });
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  assert.deepEqual(tableOf(v, "ann", () => null).map((r) => [r.playerId, r.side.id, r.side.place]), [["cy", "t2", 1], ["di", "t2", 1], ["ann", "t1", 2], ["bo", "t1", 2]]);
  // A copy without the walk (a reader not taught it): nobody has points, the teams level.
  assert.deepEqual(Object.fromEntries(T.standings(s, S.computeScores(s)).map((t) => [t.id, t.points])), { t1: 0, t2: 0 });
});

test("the couch: one team in the field, each member credited with its place, teammates never in each other's head to head", () => {
  const s = league(best({ of: 2, made: "choose", score: "sum" }));
  T.settle(s);
  choose(s, { ann: "t1", bo: "t1", cy: "t2", di: "t2" });
  points(s, 1, { ann: 5, cy: 3 });
  T.settle(s);
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const { fieldOf, rankingsOf, trophiesOf, placePoints } = jiti("../src/lib/game/couch-standings.ts");
  // As couch-hub.ts standingOf builds them: each member's place their team's; the seat shared by two (di's) a row each.
  const standingRows = tableOf(s, "ann", (p) => `u-${p}`).flatMap((r) => {
    const row = { userId: r.userId, name: r.name, place: r.side.place, rank: r.side.rank, total: r.total, seat: r.playerId, side: r.side.id };
    return r.playerId === "di" ? [row, { ...row, userId: "u-di2" }] : [row];
  });
  assert.equal(fieldOf(standingRows), 2, "two teams, however many rows");
  assert.deepEqual(standingRows.map((r) => [r.userId, r.place]), [["u-ann", 1], ["u-bo", 1], ["u-cy", 2], ["u-di", 2], ["u-di2", 2]]);
  assert.equal(placePoints(1, fieldOf(standingRows)), 10);
  const game = { leagueId: "l1", name: "L", gameName: "Weekly Lineup", gameType: "active-roster", seasonId: "s1", showId: "sh", showName: "Survivor", label: "Survivor 51", artUrl: null, year: 2026, through: 1, ended: true, rows: standingRows, before: null, teams: true };
  const people = [...PLAYERS.map((p) => ({ userId: `u-${p}`, name: p })), { userId: "u-di2", name: "di2" }];
  // Power rankings are Couch points since 2026-10-31; head to head still reads the teams' places.
  const r = rankingsOf([game], people, "u-ann", [], true);
  assert.deepEqual(r.h2h.map((h) => [h.userId, h.won, h.lost, h.tied]), [["u-cy", 1, 0, 0], ["u-di", 1, 0, 0], ["u-di2", 1, 0, 0]], "bo, a teammate, isn't there");
  const shelf = trophiesOf([game], people, "u-cy");
  assert.deepEqual(shelf.plaques[0].winners.map((w) => w.userId), ["u-ann", "u-bo"], "the winning team's members");
  assert.equal(shelf.plaques[0].by, null, "no margin in anyone's own points");
  assert.equal(shelf.titles, 0);
  assert.equal(trophiesOf([game], people, "u-ann").titles, 1, "each member credited");
});
