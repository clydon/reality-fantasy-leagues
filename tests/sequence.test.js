// The scoring sequence's steps (docs/PLAN-start-a-game-gpt.md track C, C2 part 1; src/lib/game/sequence/): hold, score each line,
// multipliers, combine, the week's result and rank, each a pure step with data in and out, and the rounding exactly where each
// game has always done it. Every draft scoring through them as before is tests/sequence-agree.test.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Seq = require("../src/lib/game/sequence/index.js");
const S = require("../src/lib/game/state-logic.js");

test("the one rounding: to the cent, float noise gone, nothing a number isn't counted", () => {
  assert.equal(Seq.round(3 * 1.1), 3.3);
  assert.equal(Seq.round(0.1 + 0.2), 0.3);
  assert.equal(Seq.round(1.004 + 1.004), 2.01);
  assert.equal(Seq.round(-0.5 * 1.15), -0.57);
  assert.equal(Seq.round(undefined), 0);
  assert.equal(Seq.round("x"), 0);
  // state-logic's roundPoints is the sequence's.
  assert.equal(S.roundPoints(3 * 1.1), Seq.round(3 * 1.1));
});

test("1. hold: what a seat held for an episode, its moves from then on taken back, newest first", () => {
  const log = [
    { playerId: "ann", episode: 2, droppedCastawayId: "a", addedCastawayId: "x" },
    { playerId: "bo", episode: 1, droppedCastawayId: "b", addedCastawayId: "y" },
    { playerId: "ann", episode: 4, droppedCastawayId: "x", addedCastawayId: "z" },
    { playerId: "ann", droppedCastawayId: "q", addedCastawayId: "r" },
  ];
  const now = ["c", "z", "r"];
  // A move logged at episode k (after its results) counts from k + 1.
  assert.deepEqual([...Seq.heldAt(now, log, "ann", 5)], ["c", "z", "r"]);
  assert.deepEqual([...Seq.heldAt(now, log, "ann", 4)], ["c", "r", "x"]);
  assert.deepEqual([...Seq.heldAt(now, log, "ann", 3)], ["c", "r", "x"]);
  assert.deepEqual([...Seq.heldAt(now, log, "ann", 2)], ["c", "r", "a"], "both moves taken back, newest first");
  // A move with no episode is from before the game: it stands. Someone else's moves aren't this seat's. Now (Infinity): as held.
  assert.deepEqual([...Seq.heldAt(now, log, "ann", 1)], ["c", "r", "a"]);
  assert.deepEqual([...Seq.heldAt(["y"], log, "bo", 1)], ["b"]);
  assert.deepEqual([...Seq.heldAt(now, log, "ann", Infinity)], now);
  assert.deepEqual([...Seq.heldAt(now, undefined, "ann", 1)], now);
});

test("2. a place is a value: out at a place for good, still in 1 plus the boots so far; in reverse, the other way", () => {
  const mark = { size: 18, out: 5, reverse: false };
  assert.equal(Seq.placed(4, mark), 4);
  assert.equal(Seq.placed(18, mark), 18, "the winner of 18");
  assert.equal(Seq.stillIn(mark), 6);
  const rev = { size: 18, out: 5, reverse: true };
  assert.equal(Seq.placed(1, rev), 18, "the first one out carries you");
  assert.equal(Seq.placed(18, rev), 1);
  assert.equal(Seq.stillIn(rev), 13, "what they'd have going home next");
  assert.equal(Seq.stillIn({ size: 18, out: 0, reverse: false }), 1);
});

test("2. moments: each holding's raw points added up moment by moment, each sum rounded; a group's sum or mean", () => {
  const events = [
    { castawayId: "a", points: 1.004 },
    { castawayId: "b", points: 3 },
    { castawayId: "a", points: 1.004 },
    { castawayId: "z", points: 9 },
  ];
  const raw = Seq.momentRaw(["a", "b", "c"], events);
  // Rounded as they add up: 1 then 2 (not 2.01, the unrounded sum's).
  assert.deepEqual([...raw], [["a", 2], ["b", 3], ["c", 0]]);
  // A group slot: its members' sum, or their mean over the group as research has it (someone off the cast still counts in it).
  assert.equal(Seq.groupRaw(["a", "b"], 2, events, "sum"), 1.004 + 3 + 1.004);
  assert.equal(Seq.groupRaw(["a", "b"], 2, events, "mean"), (1.004 + 3 + 1.004) / 2);
  assert.equal(Seq.groupRaw(["b"], 3, events, "mean"), 1, "a pair of three with one on the cast");
});

test("2. side bets: a right guess pays only on a bet with company", () => {
  const bets = [
    { points: 2, predictions: [{ playerId: "ann", correct: true }, { playerId: "bo", correct: false }] },
    { points: 1, predictions: [{ playerId: "cy", correct: true }] },
    { points: 3, predictions: [{ playerId: "ann", correct: true }, { playerId: "bo", correct: true }, { playerId: "di", correct: null }] },
    { predictions: [{ playerId: "ann", correct: true }, { playerId: "bo", correct: true }] },
  ];
  assert.ok(Seq.betLines(bets).every((l, i) => l.bet === bets[[0, 2, 2, 3, 3][i]]), "each line with its bet");
  assert.deepEqual(Seq.betLines(bets).map(({ playerId, points }) => ({ playerId, points })), [
    { playerId: "ann", points: 2 },
    { playerId: "ann", points: 3 },
    { playerId: "bo", points: 3 },
    { playerId: "ann", points: 0 },
    { playerId: "bo", points: 0 },
  ]);
  assert.deepEqual(Seq.betLines(undefined), []);
});

test("3. multipliers: each factor in order, left to right, then rounded", () => {
  assert.equal(Seq.multiply(2.05, [2, 1.5]), 6.15);
  assert.equal(Seq.multiply(3.3, []), 3.3);
  assert.equal(Seq.multiply(1.11, [1, 1]), 1.11);
  // Left to right: (0.1 × 3) × 0.7, as a captain's then the episode's always were.
  assert.equal(Seq.multiply(0.1, [3, 0.7]), Seq.round(0.1 * 3 * 0.7));
});

test("4. combine: best ball's best n (a tie to the earlier line), an episode's total with its slots, a sum", () => {
  const lines = () => [{ points: 2 }, { points: 5 }, { points: 2 }, { points: -1 }];
  assert.deepEqual(Seq.best(lines(), 2).map((l) => l.counted), [true, true, false, false], "the tie goes to the earlier line");
  assert.deepEqual(Seq.best(lines(), 0).map((l) => l.counted), [true, true, true, true], "no best n: every line counts");
  assert.deepEqual(Seq.best(lines(), 9).map((l) => l.counted), [true, true, true, true]);
  const counted = Seq.best(lines(), 2);
  assert.equal(Seq.episodeTotal(counted, [{ points: 0.333 }, { points: 0.333 }]), 7.67);
  assert.equal(Seq.episodeTotal(counted), 7);
  assert.equal(Seq.sum([10, 0.1, 0.2]), 10.3);
  assert.equal(Seq.sum([]), 0);
});

test("5 and 6. a running total rounded each step; a row's total; ranks by total and by a key", () => {
  assert.equal(Seq.add(0.57, 0.575), 1.15);
  assert.equal(Seq.add(10, 0.1 + 0.2), 10.3);
  // A lineup's row rounds; an Outlast's doesn't (whole numbers); side bets only while they count.
  const row = { locked: 10.004, bonus: 3, finale: 2 };
  assert.equal(Seq.total(row, true, true), 15);
  assert.equal(Seq.total(row, false, true), 12);
  assert.equal(Seq.total(row, true, false), 15.004);
  const rows = [{ id: "a", total: 3 }, { id: "b", total: 7 }, { id: "c", total: 3 }];
  assert.deepEqual(Seq.byTotal(rows.slice()).map((r) => r.id), ["b", "a", "c"], "a tie keeps their order");
  const keyed = [{ id: "a", k: [1, 2] }, { id: "b", k: [1, 5] }, { id: "c", k: [2] }, { id: "d", k: [1, 2] }];
  assert.deepEqual(Seq.byKey(keyed, (r) => r.k).map((r) => r.id), ["c", "b", "a", "d"]);
  assert.ok(Seq.compareKeys([1, 2], [1, 1]) > 0);
  assert.equal(Seq.compareKeys([1], [1, 0]), 0, "a missing number is 0");
  assert.equal(S.PickEmScoringStrategy.compareKeys([0, 3], [0, 1]), Seq.compareKeys([0, 3], [0, 1]), "the engine's compareKeys is the sequence's");
});
