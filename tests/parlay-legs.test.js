// A parlay's legs that combine their own way (docs/PLAN-start-a-game-gpt.md track C, C2 part 4a: combinations the scoring sequence
// opens where the order is settled): a leg that rolls over (its window's worth, the jackpot, then the parlay), shrinks (its call's
// worth when it was made, then the parlay) or pays only the only one right (its share, then the parlay: the same either way round,
// as only one line is left). Still refused: a staked leg (C6, money) and a split pot (a rule question: does the parlay multiply your
// share, or your call before the split? the plan's Noticed). Every number worked out by hand. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const IMM = { id: "imm", ask: "Who wins immunity?", answer: "person", points: 2, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const ROLL = { ...OUT, rollover: true };
const ONLY = { ...OUT, share: "only" };
const WIN = { id: "win", ask: "Who wins?", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "winner" } };
const SECOND = { id: "second", ask: "Who's runner-up?", answer: "person", points: 2, settle: { by: "results", take: "placed", place: 2 } };
const game = (ask, parlays) => ({ spec: 1, get: { by: "none" }, count: null, score: { by: "answers", parlays }, rank: { by: "total" }, ask });
const CTX = {
  moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }],
  results: true, winner: true, roles: [], grouped: true, jury: true, phases: [],
};

test("its shape: legs that roll over, shrink, pay only the only one right or (C6) are staked; not a split pot", () => {
  const ok = (ask, of, times = 3) => G.specProblems(game(ask, [{ of, times }]), CTX).map((p) => p.problem);
  assert.deepEqual(ok([ROLL, IMM], ["out", "imm"]), []);
  assert.deepEqual(ok([ONLY, IMM], ["out", "imm"]), []);
  assert.deepEqual(ok([{ ...ROLL, share: "only" }, IMM], ["out", "imm"]), [], "a pot nobody else gets that rolls over");
  assert.deepEqual(ok([WIN, SECOND], ["win", "second"], 2), []);
  assert.deepEqual(ok([{ ...WIN, share: "only" }, SECOND], ["win", "second"], 2), []);
  assert.equal(G.typeOf(game([ROLL, IMM], [{ of: ["out", "imm"], times: 3 }])), "questions");
  // C6: a staked leg, its stake's winnings multiplied with its points (tests/money.test.js).
  assert.deepEqual(ok([{ ...OUT, wager: 3 }, IMM], ["out", "imm"]), []);
  assert.deepEqual(ok([{ ...OUT, share: "split" }, IMM], ["out", "imm"]), ['"out" splits a pot: a parlay on a split pot waits on a rule (does it multiply your share, or your call before the split?)']);
  // Still asked the same way, so they share their windows.
  assert.deepEqual(ok([ROLL, { ...IMM, asked: "every", every: 2 }], ["out", "imm"]).length, 1);
});

/** A Survivor league of six castaways and three players, made a game of `ask` with its parlays through setGame. */
function league(ask, parlays) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < 6; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, game(ask, parlays), { ctx: CTX }), []);
  return s;
}
const A = (question, episode, list) => list.map(([playerId, answer, more]) => ({ playerId, question, episode, answer, ...more }));

test("a leg that rolls over: its jackpot, then the parlay", () => {
  const s = league([ROLL, IMM], [{ of: ["out", "imm"], times: 3 }]);
  const c = (i) => s.castaways[i].id;
  for (const [n, gone, imm] of [[1, 5, 0], [2, 4, 1]]) {
    const ep = S.ensureEpisodeNumber(s, n, false);
    S.addElimination(s, ep.id, c(gone), "Voted Out");
    S.addScoringEvent(s, ep.id, "individualImmunity", c(imm));
  }
  const g = S.AnswerLogic.grade(s, [
    // Episode 1: nobody right on who goes home (2 rolls over); ann right on immunity alone (2).
    ...A("out", 1, [["ann", c(3)], ["bo", c(2)]]),
    ...A("imm", 1, [["ann", c(0)]]),
    // Episode 2: who goes home is worth 4; ann right on both (4 and 2, tripled: 12 and 6), bo only on who goes home (4).
    ...A("out", 2, [["ann", c(4)], ["bo", c(4)]]),
    ...A("imm", 2, [["ann", c(1)], ["bo", c(2)]]),
  ]);
  assert.deepEqual([g.worth.get("out|1"), g.worth.get("out|2")], [2, 4]);
  assert.deepEqual(Object.fromEntries(g.earned.get("out|2")), { ann: 12, bo: 4 });
  assert.deepEqual(Object.fromEntries(g.earned.get("imm|2")), { ann: 6 });
  assert.deepEqual(Object.fromEntries(g.points), { ann: 20, bo: 4 });
});

test("a leg that pays only the only one right: its share, then the parlay", () => {
  const s = league([ONLY, IMM], [{ of: ["out", "imm"], times: 3 }]);
  const c = (i) => s.castaways[i].id;
  for (const [n, gone, imm] of [[1, 5, 0], [2, 4, 1]]) {
    const ep = S.ensureEpisodeNumber(s, n, false);
    S.addElimination(s, ep.id, c(gone), "Voted Out");
    S.addScoringEvent(s, ep.id, "individualImmunity", c(imm));
  }
  const g = S.AnswerLogic.grade(s, [
    // Episode 1: ann the only one right on who goes home, and right on immunity: 2 and 2, tripled.
    ...A("out", 1, [["ann", c(5)], ["bo", c(3)]]),
    ...A("imm", 1, [["ann", c(0)], ["bo", c(0)]]),
    // Episode 2: ann and bo both right on who goes home (nobody's), ann right on immunity too: right on both, so her immunity
    // triples (6), and who goes home gave her nothing to triple.
    ...A("out", 2, [["ann", c(4)], ["bo", c(4)]]),
    ...A("imm", 2, [["ann", c(1)]]),
  ]);
  assert.deepEqual(Object.fromEntries(g.earned.get("out|1")), { ann: 6 });
  assert.deepEqual(Object.fromEntries(g.earned.get("imm|1")), { ann: 6, bo: 2 });
  assert.equal(g.earned.get("out|2").size, 0);
  assert.deepEqual(Object.fromEntries(g.earned.get("imm|2")), { ann: 6 });
  assert.deepEqual(Object.fromEntries(g.points), { ann: 18, bo: 2 });
});

test("a leg that shrinks: its call's worth when it was made, then the parlay; the words", () => {
  const s = league([WIN, SECOND], [{ of: ["win", "second"], times: 2 }]);
  const c = (i) => s.castaways[i].id;
  const g = S.AnswerLogic.grade(s, [
    // ann called the winner three episodes in (7) and the runner-up: both right, doubled (14 and 4). bo on time (10), runner-up wrong.
    ...A("win", 0, [["ann", c(0), { late: 3 }], ["bo", c(0), { late: 0 }]]),
    ...A("second", 0, [["ann", c(1)], ["bo", c(2)]]),
  ], { from: 1, to: null, over: true, episodes: new Map(), winner: c(0), ended: true, order: [c(0), c(1), c(2)], names: new Map() });
  assert.deepEqual(Object.fromEntries(g.earned.get("win|0")), { ann: 14, bo: 10 });
  assert.deepEqual(Object.fromEntries(g.earned.get("second|0")), { ann: 4 });
  assert.deepEqual(Object.fromEntries(g.points), { ann: 18, bo: 10 });
  const d = G.describeSpec(game([WIN, SECOND], [{ of: ["win", "second"], times: 2 }]), { show: "Survivor 51" });
  assert.match(d.sentence, /The earlier you call it, the more it's worth\. Right on who wins and who's runner-up together: double the points\./);
});
