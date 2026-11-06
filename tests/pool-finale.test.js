// A pool's finale (docs/PLAN-start-a-game-gpt.md R1 part 3; the Decisions table, "A pool's finale", the user's on 2026-10-30):
// only the winner survives the finale. A pick on whoever the results record as winning (each winner, on a show with several) is
// right; a finalist who loses is out like any exit, and so is anyone else who went home that night; a show nobody wins keeps the
// rule of every night (whoever isn't among the episode's exits survives). A pool with lives loses one on a losing finalist, a
// second pick counts on a finale night that sent two or more home, a finalist whose exit the results miss went home with the rest
// once the winner is recorded, and a game of questions' "who stays" and "who goes home" grade the finale the same way (the
// engine's one reading of a night: nightOf). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const Formats = require("../src/lib/game/formats/index.js");
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
const POOL = { preset: "survival-pool" };

/** A pool of six, C0 to C5, players ann, bo and cy, its game `spec`; Episodes 1 to 3 made (3 the finale), none with results. */
function league(spec, settings = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  Object.assign(s.settings, settings);
  for (let i = 0; i < 6; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let n = 1; n <= 3; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
/** Who picks whom in episode n ({ ann: index | [first, second] }), through the engine's own write. */
function picks(s, n, who) {
  for (const [p, x] of Object.entries(who)) {
    const [first, second] = Array.isArray(x) ? x : [x];
    S.setPickEmPick(s, ep(s, n).id, p, cid(s, first));
    if (second !== undefined) S.setPickEmPick(s, ep(s, n).id, p, cid(s, second), { second: true });
    assert.equal(S.pickEmPickFor(s, ep(s, n).id, p).castawayId, cid(s, first), `${p}'s pick in ${n} is stored`);
  }
}
/** Episode n's exits: [index, method]. */
const exits = (s, n, list) => list.forEach(([i, method]) => S.addElimination(s, ep(s, n).id, cid(s, i), method));
/** Two nights everyone survives (C0, then C1, go home), with picks the cycle allows, then the finale's picks. */
function toFinale(s, finale) {
  picks(s, 1, { ann: 2, bo: 3, cy: 4 });
  exits(s, 1, [[0, "Voted Out"]]);
  picks(s, 2, { ann: 3, bo: 4, cy: 2 });
  exits(s, 2, [[1, "Voted Out"]]);
  picks(s, 3, finale);
}
/** Survivor's finale: C2 loses the fire, C3 and C4 lose the jury vote, C5 is the Sole Survivor. */
const SURVIVOR_FINALE = [[2, "Lost Fire-Making"], [3, "Lost Final Tribal (Jury Vote)"], [4, "Lost Final Tribal (Jury Vote)"], [5, "Sole Survivor"]];
const finaleRow = (s, p) => S.pickEmHistory(s, p).rows.find((r) => r.episode === 3);

test("only the winner survives the finale: a pick on the winner is right, on a losing finalist or the fire's loser wrong", () => {
  const s = league(POOL);
  toFinale(s, { ann: 5, bo: 2, cy: 3 });
  exits(s, 3, SURVIVOR_FINALE);
  assert.equal(S.seasonEnded(s), true);
  assert.deepEqual([finaleRow(s, "ann").correct, finaleRow(s, "ann").points, finaleRow(s, "ann").streak], [true, 1, 3], "the Sole Survivor survives it");
  assert.deepEqual([finaleRow(s, "bo").correct, finaleRow(s, "bo").streak], [false, 0], "the fire's loser went home");
  assert.deepEqual([finaleRow(s, "cy").correct, finaleRow(s, "cy").streak], [false, 0], "a finalist who loses is out like any exit");
  const h = S.pickEmHistory(s, "ann");
  assert.deepEqual([h.total, h.longestStreak, h.currentStreak], [3, 3, 3]);
  assert.deepEqual(S.computeScores(s).map((r) => r.playerId)[0], "ann", "the one who called the winner leads");
  // Taken back (a corrected result): the winner's exit gone, their pick waits again with the night's other results in place.
  S.removeElimination(s, ep(s, 3).id, cid(s, 5));
  assert.equal(finaleRow(s, "ann").correct, true, "still decided, and nobody's exit is C5's: C5 survives");
  S.addElimination(s, ep(s, 3).id, cid(s, 5), "Lost Final Tribal (Jury Vote)");
  assert.equal(finaleRow(s, "ann").correct, false, "corrected to a losing finalist: the pick is wrong");
});

test("a show with several winners: a pick on any of them survives the finale; a banished finalist goes home", () => {
  const s = league(POOL, { showFormat: "traitors" });
  toFinale(s, { ann: 5, bo: 2, cy: 3 });
  exits(s, 3, [[3, "Banished"], [4, "Finalist"], [2, "Winner"], [5, "Winner"]]);
  assert.deepEqual(["ann", "bo", "cy"].map((p) => finaleRow(s, p).correct), [true, true, false]);
  assert.equal(S.PickEmLogic.double(s, ep(s, 3)), true, "two went home besides the winners");
});

test("a show nobody wins keeps the rule of every night: whoever isn't among the finale's exits survives it", () => {
  const data = JSON.parse(JSON.stringify(Formats.FORMATS.survivor.data));
  data.winnerExitMethod = null;
  data.endgameExitMethods = ["Lost Final Tribal (Jury Vote)"];
  const s = league(POOL, { leagueRulesetData: data });
  assert.equal(S.formatOf(s).winnerExitMethod, null);
  toFinale(s, { ann: 5, bo: 2, cy: 3 });
  exits(s, 3, [[2, "Voted Out"], [3, "Lost Final Tribal (Jury Vote)"], [4, "Sole Survivor"]]);
  assert.deepEqual(["ann", "bo", "cy"].map((p) => finaleRow(s, p).correct), [true, false, false], "C5 left in no exit; an exit named as a win is still an exit");
});

test("a pool with lives at the finale: a losing finalist costs a life, and with none left they're out; the winner's pick stands", () => {
  const s = league({ ...POOL, score: { by: "survive", lives: 1 }, rank: { by: "standing" } });
  toFinale(s, { ann: 5, bo: 2, cy: 3 });
  exits(s, 3, SURVIVOR_FINALE);
  const [ann, bo, cy] = ["ann", "bo", "cy"].map((p) => S.pickEmHistory(s, p));
  assert.deepEqual([ann.lives, ann.out, ann.total], [1, null, 3]);
  assert.deepEqual([bo.lives, bo.out, cy.out], [0, 3, 3]);
  assert.equal(finaleRow(s, "cy").out, true);
  assert.deepEqual(S.computeScores(s).map((r) => r.playerId)[0], "ann", "the only one still standing");
});

test("a second pick on a finale night: it counts (two or more went home), the winner among the night's survivors", () => {
  const s = league({ ...POOL, get: { by: "pick", second: { fallback: "void" } } });
  toFinale(s, { ann: [4, 5], bo: [5, 2] });
  exits(s, 3, SURVIVOR_FINALE);
  assert.equal(S.PickEmLogic.double(s, ep(s, 3)), true);
  const a = finaleRow(s, "ann");
  assert.deepEqual([a.correct, a.second.correct, a.second.points], [false, true, 1], "ann's second, the winner, counted right");
  const b = finaleRow(s, "bo");
  assert.deepEqual([b.correct, b.points, b.second.correct], [true, 1, false]);
});

test("a finale whose results record the winner but miss a finalist: only the winner's pick is right", () => {
  const s = league(POOL);
  toFinale(s, { ann: 5, bo: 2, cy: 3 });
  exits(s, 3, [[2, "Lost Fire-Making"], [5, "Sole Survivor"]]);
  assert.deepEqual(["ann", "bo", "cy"].map((p) => finaleRow(s, p).correct), [true, false, false], "C3 has no exit, and isn't the winner");
  assert.equal(S.PickEmLogic.wentHome(s, ep(s, 3), cid(s, 3)), true);
  assert.equal(S.PickEmLogic.wentHome(s, ep(s, 3), cid(s, 5)), false);
  assert.equal(S.PickEmLogic.double(s, ep(s, 3)), false, "a second pick counts on the exits recorded: one went home");
  // Before the winner is recorded, it's a night like any other: whoever isn't among its exits stayed.
  S.removeElimination(s, ep(s, 3).id, cid(s, 5));
  assert.deepEqual(["ann", "bo", "cy"].map((p) => finaleRow(s, p).correct), [true, false, true]);
});

test("a game of questions grades the finale the same way: the winner stays, everyone else in it went home", () => {
  const STAYS = { id: "stays", ask: "Who stays?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "stays" } };
  const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
  const s = league({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [STAYS, OUT] });
  exits(s, 1, [[0, "Voted Out"]]);
  exits(s, 2, [[1, "Voted Out"]]);
  exits(s, 3, SURVIVOR_FINALE);
  const verdict = (q) => G.verdictOf(G.fullQuestion(q), 3, S.AnswerLogic.facts(s));
  assert.deepEqual(verdict(STAYS), { state: "known", right: [cid(s, 5)] });
  assert.deepEqual(verdict(OUT).right, [2, 3, 4].map((i) => cid(s, i)));
  // A finalist whose exit isn't recorded went home with the rest; before the winner is, they stayed.
  S.removeElimination(s, ep(s, 3).id, cid(s, 4));
  assert.deepEqual(verdict(STAYS).right, [cid(s, 5)]);
  assert.deepEqual(verdict(OUT).right, [2, 3, 4].map((i) => cid(s, i)));
  S.removeElimination(s, ep(s, 3).id, cid(s, 5));
  assert.deepEqual(verdict(STAYS).right, [4, 5].map((i) => cid(s, i)));
  assert.deepEqual(verdict(OUT).right, [2, 3].map((i) => cid(s, i)));
});
