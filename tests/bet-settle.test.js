// The AI settles side bets (BACKLOG 87, the user's decision 2026-11-15): with an episode's final results, each bet is settled
// from the research's answer (state-logic.js BetLogic.settleByAI; the server's src/lib/server/bet-settle.ts reads the answers);
// whoever runs the game can change a mark, theirs wins, and the AI never settles that bet again; the page says who settled it or
// who changed it (BetLogic.decision, src/lib/game/week-view.ts sideBetsOf). A bet the research couldn't settle stays open and
// counts for nothing. On a made-up season, so no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { sideBetsOf } = jiti("../src/lib/game/week-view.ts");
const S = require("../src/lib/game/state-logic.js");

const data = {
  id: "bets", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: 10,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  groups: [{ key: "a", name: "A", color: "#123456" }],
  castaways: Array.from({ length: 12 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 12 - i, groupKey: "a",
    exitEpisode: i < 9 ? i + 1 : 10, exitMethod: i === 11 ? "Sole Survivor" : "Voted Out",
  })),
};

/** A Classic game through Episode 5 with side bets on, one bet on Episode 5 that ann and bo called before it aired. */
function game(guesses = ["Yes", "No"]) {
  const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "classic-draft", 5))));
  S.updateSettings(s, "bonusEnabled", true);
  const ep = s.episodes.find((e) => e.number === 5);
  ep.bets = [{ id: "bet_1", label: "Will anyone play an idol?", points: 3, predictions: [], createdByPlayerId: null }];
  s.players.slice(0, guesses.length).forEach((p, i) => ep.bets[0].predictions.push({ id: `pred_${i}`, playerId: p.id, guess: guesses[i], correct: null }));
  S.setResultsStage(s, ep.id, "final");
  const base = Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.bonus]));
  return { s, ep, bet: ep.bets[0], ann: s.players[0], bo: s.players[1], base };
}
const answer = (over = {}) => ({ question: "Will anyone play an idol?", guesses: ["Yes", "No"], answer: "Yes", correctGuesses: ["Yes"], evidence: "Castaway 4 played an idol at Tribal.", sources: [], confidence: "high", ...over });
// What this bet adds to a player's bonus (the demo season has others of its own).
let base = {};
const bonus = (s, id) => S.computeScores(s).find((r) => r.playerId === id).bonus - (base[id] ?? 0);
const start = (...a) => { const g = game(...a); base = g.base; return g; };

test("sure of its answer, the AI marks every call, and the right ones pay", () => {
  const { s, ep, bet, ann, bo } = start();
  assert.equal(S.settleBetByAI(s, ep.id, bet.id, answer(), "2026-11-19T17:00:00Z"), "settled");
  assert.deepEqual(bet.predictions.map((p) => p.correct), [true, false]);
  assert.equal(bet.settledBy, "ai");
  assert.deepEqual([bonus(s, ann.id), bonus(s, bo.id)], [3, 0]);
  assert.deepEqual(S.betDecision(bet), { by: "ai", who: null });
  assert.equal(S.settleBetByAI(s, ep.id, bet.id, answer(), "2026-11-20T17:00:00Z"), null, "the same answer again changes nothing");
  assert.equal(bet.ai.at, "2026-11-19T17:00:00Z");
  assert.equal(S.betKey("  Will anyone  play an idol?? "), S.betKey("will anyone play an idol"), "matched by wording, not spacing or punctuation");
});

test("not sure, no answer, or a call it never saw: recorded for whoever runs the game, nothing marked, nothing paid", () => {
  for (const [why, a] of [
    ["low confidence", answer({ confidence: "low" })],
    ["no answer", answer({ answer: null, correctGuesses: [], evidence: null })],
    ["a call it wasn't shown", answer({ guesses: ["Yes"] })],
  ]) {
    const { s, ep, bet, ann } = start();
    assert.equal(S.settleBetByAI(s, ep.id, bet.id, a), "suggested", why);
    assert.deepEqual(bet.predictions.map((p) => p.correct), [null, null], why);
    assert.equal(bet.settledBy, undefined, why);
    assert.equal(bet.ai.settled, false, why);
    assert.equal(bonus(s, ann.id), 0, `${why}: it counts for nothing until settled`);
    assert.equal(S.BetLogic.aiMaySettle(bet), true, `${why}: a later, surer answer can still settle it`);
  }
  const { s, ep, bet } = start();
  S.settleBetByAI(s, ep.id, bet.id, answer());
  S.settleBetByAI(s, ep.id, bet.id, answer({ confidence: "low" }));
  assert.deepEqual([bet.predictions.map((p) => p.correct), bet.settledBy], [[null, null], undefined], "a later answer it isn't sure of takes its own marks back");
});

test("the commissioner changes the AI's call: theirs wins, the AI leaves it alone, and the page says who changed it", () => {
  const { s, ep, bet, ann, bo } = start();
  S.settleBetByAI(s, ep.id, bet.id, answer());
  S.setBetPredictionCorrect(s, ep.id, bet.id, "pred_0", false, bo.id);
  S.setBetPredictionCorrect(s, ep.id, bet.id, "pred_1", true, bo.id);
  assert.deepEqual(S.betDecision(bet), { by: "changed", who: bo.id });
  assert.deepEqual([bonus(s, ann.id), bonus(s, bo.id)], [0, 3]);
  assert.equal(S.settleBetByAI(s, ep.id, bet.id, answer()), null, "the AI never settles a bet a person has marked");
  assert.deepEqual(bet.predictions.map((p) => p.correct), [false, true]);
  S.setBetPredictionCorrect(s, ep.id, bet.id, "pred_0", true, bo.id);
  S.setBetPredictionCorrect(s, ep.id, bet.id, "pred_1", false, bo.id);
  assert.deepEqual(S.betDecision(bet), { by: "ai", who: null }, "changed back to the AI's marks: the AI's call stands");

  const own = start();
  S.setBetPredictionCorrect(own.s, own.ep.id, own.bet.id, "pred_0", true, own.ann.id);
  S.setBetPredictionCorrect(own.s, own.ep.id, own.bet.id, "pred_1", false, own.ann.id);
  assert.deepEqual(S.betDecision(own.bet), { by: "person", who: own.ann.id }, "one the AI didn't settle: settled by them");
  const before = start();
  before.bet.predictions[0].correct = true;
  assert.equal(S.settleBetByAI(before.s, before.ep.id, before.bet.id, answer()), null, "a bet marked by hand before any of this was recorded stays as marked");
});

test("the page's view: who settled it, the AI's answer, and none of it for someone who hasn't seen the episode", () => {
  const { s, ep, bet, ann, bo } = start();
  S.settleBetByAI(s, ep.id, bet.id, answer());
  S.setBetPredictionCorrect(s, ep.id, bet.id, "pred_1", true, bo.id);
  S.setBetPredictionCorrect(s, ep.id, bet.id, "pred_0", false, bo.id);
  const names = new Map(s.players.map((p) => [p.id, p.name]));
  const seen = sideBetsOf(s, bo.id, names, 5, Date.parse("2030-01-01")).bets.find((b) => b.betId === bet.id);
  assert.deepEqual(seen.decided, { by: "changed", who: "bo", you: true });
  assert.deepEqual([seen.ai.answer, seen.ai.settled, seen.stage, seen.settled], ["Yes", true, "final", true]);

  const behind = S.SpoilerLogic.viewThrough(s, 4);
  const hidden = behind.episodes.find((e) => e.number === 5).bets[0];
  assert.deepEqual([hidden.ai, hidden.settledBy, hidden.predictions.map((p) => p.correct)], [undefined, undefined, [null, null]], "the AI's answer is a spoiler");
  assert.ok(!sideBetsOf(behind, ann.id, names, 4, Date.parse("2030-01-01"))?.bets.some((b) => b.played && b.betId === bet.id));
});

test("early results: nothing is settled yet, and the view says the stage", () => {
  const { s, ep, bet, ann } = start();
  S.setResultsStage(s, ep.id, "early");
  const names = new Map(s.players.map((p) => [p.id, p.name]));
  const b = sideBetsOf(s, ann.id, names, 5, Date.parse("2030-01-01")).bets.find((x) => x.betId === bet.id);
  assert.deepEqual([b.stage, b.settled, b.ai, b.decided], ["early", false, null, null]);
});
