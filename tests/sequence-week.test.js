// The scoring sequence's step 5, the week's results (docs/PLAN-start-a-game-gpt.md track C, C2 part 2; src/lib/game/sequence/):
// what each episode's totals make, each a pure step with data in and out: an episode's growth; a pool's tally a night at a time
// (a pick right or wrong, a mulligan, a life, a night's right picks before its wrong ones, a buyback or out, the night taken back);
// everyone out and one left; a race won, a cut (its line, a tie kept or sent, half, never everyone), the cuts after an episode
// (the guillotine's window, an episode, before a phase, a quiet night skipped) and the knockouts' walk; head to head's round
// robin, median, bracket and walk (the median or a bye for an odd seat, a quiet night skipped or tied, the standings, the
// playoffs with byes, a tie to the better seed, the season over first); a team's step (summed, the mean); co-op's night; and
// step 6's keys (last one standing, head to head's record). Every game scoring through them as before is
// tests/sequence-agree.test.js (the week's shapes). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Seq = require("../src/lib/game/sequence/index.js");
const S = require("../src/lib/game/state-logic.js");

const totals = (o) => new Map(Object.entries(o));

test("an episode's growth: its total through it less the one before, rounded; nothing before is from nothing", () => {
  assert.equal(Seq.grown(totals({ a: 3.3 }), totals({ a: 1.1 }), "a"), 2.2);
  assert.equal(Seq.grown(totals({ a: 3.3 }), null, "a"), 3.3);
  assert.equal(Seq.grown(totals({}), totals({ a: 2 }), "a"), -2);
  assert.equal(Seq.grown(totals({ a: 0.3 }), totals({ a: 0.1 }), "a"), 0.2, "float noise gone");
});

test("a pool's tally: right grows the streak and scores; wrong forgives with a mulligan, else resets and costs a life", () => {
  const plain = Seq.poolTally(null);
  assert.deepEqual(plain, { current: 0, longest: 0, total: 0, lives: null, mulligans: 0, buybacks: 0, cost: 0, out: null, shared: false });
  assert.deepEqual(Seq.poolPick(plain, true, 2), { correct: true, points: 2 });
  assert.deepEqual(Seq.poolPick(plain, true, 2), { correct: true, points: 2 });
  assert.deepEqual(Seq.poolPick(plain, false, 2), { correct: false, points: 0 }, "no lives: a miss resets the streak, nothing more");
  assert.deepEqual([plain.current, plain.longest, plain.total, plain.lives], [0, 2, 4, null]);
  const t = Seq.poolTally({ lives: 2, mulligans: 1, buyback: { times: 1, cost: 3 } });
  assert.deepEqual([t.lives, t.mulligans, t.buybacks], [2, 1, 1]);
  Seq.poolPick(t, true, 1);
  assert.deepEqual(Seq.poolPick(t, false, 1), { correct: false, points: 0, forgiven: true }, "the first wrong pick forgiven");
  assert.equal(t.current, 1, "a forgiven pick keeps the streak");
  assert.deepEqual(Seq.poolPick(t, false, 1), { correct: false, points: 0, lifeLost: true });
  assert.deepEqual([t.current, t.lives, t.mulligans], [0, 1, 0]);
  Seq.poolPick(t, false, 1);
  assert.equal(t.lives, 0);
  assert.deepEqual(Seq.poolPick(t, false, 1), { correct: false, points: 0 }, "none left to lose");
});

test("a pool's night: its right picks first, then its wrong ones, so a wrong pick ends the streak whichever it was", () => {
  const a = Seq.poolTally(null);
  const night = Seq.poolNight(a, [["first", false], ["second", true]], 1);
  assert.deepEqual(night, { second: { correct: true, points: 1 }, first: { correct: false, points: 0 } });
  assert.deepEqual([a.current, a.longest, a.total], [0, 1, 1], "the right one counted, then the wrong one ended it");
  // With lives, the night's wrong pick costs the life after its right one scores.
  const b = Seq.poolTally({ lives: 1, mulligans: 0 });
  Seq.poolNight(b, [["first", true], ["second", false]], 1);
  assert.deepEqual([b.total, b.lives], [1, 0]);
});

test("a night that empties a seat's lives: bought back while one's left and its deadline hasn't passed, else out", () => {
  const buyback = { times: 1, cost: 2 };
  const t = Seq.poolTally({ lives: 1, mulligans: 0, buyback });
  t.total = 5;
  assert.equal(Seq.poolEmptied(t, 3, buyback, () => true), null, "lives left: nothing");
  Seq.poolPick(t, false, 1);
  let asked = null;
  assert.deepEqual(Seq.poolEmptied(t, 3, buyback, (n) => { asked = n; return true; }), { back: 2 });
  assert.equal(asked, 3, "the deadline is asked of the night");
  assert.deepEqual([t.lives, t.buybacks, t.cost, t.total, t.out], [1, 0, 2, 3, null]);
  Seq.poolPick(t, false, 1);
  assert.deepEqual(Seq.poolEmptied(t, 5, buyback, () => true), { out: 5 }, "no buyback left: out for good");
  assert.equal(t.out, 5);
  // Past its deadline: out, and the deadline is never asked without a buyback left.
  const late = Seq.poolTally({ lives: 1, mulligans: 0, buyback });
  Seq.poolPick(late, false, 1);
  assert.deepEqual(Seq.poolEmptied(late, 6, buyback, () => false), { out: 6 });
  const none = Seq.poolTally({ lives: 1, mulligans: 0 });
  Seq.poolPick(none, false, 1);
  assert.deepEqual(Seq.poolEmptied(none, 2, null, () => { throw new Error("asked"); }), { out: 2 });
  // A pool without lives never empties.
  assert.equal(Seq.poolEmptied(Seq.poolTally(null), 1, null, () => true), null);
});

test("the night taken back (allOut 'back'): in again with the lives, mulligans and streak it had before it", () => {
  const t = Seq.poolTally({ lives: 1, mulligans: 1 });
  Seq.poolPick(t, true, 1);
  Seq.poolPick(t, true, 1);
  const was = { lives: t.lives, mulligans: t.mulligans, current: t.current };
  Seq.poolPick(t, false, 1);
  Seq.poolPick(t, false, 1);
  Seq.poolEmptied(t, 4, null, () => false);
  assert.equal(t.out, 4);
  assert.equal(Seq.poolSpare(t, 3, was), false, "not the night it went out");
  assert.equal(Seq.poolSpare(t, 4, was), true);
  assert.deepEqual([t.out, t.lives, t.mulligans, t.current, t.total], [null, 1, 1, 2, 2], "the points it had stay");
});

test("everyone out, one left: the night everyone left goes out (two or more), and one or none left of two or more", () => {
  assert.equal(Seq.allOut(2, 2), true);
  assert.equal(Seq.allOut(3, 3), true);
  assert.equal(Seq.allOut(1, 1), false, "one left going out is just going out");
  assert.equal(Seq.allOut(2, 3), false);
  const isIn = (id) => id !== "x";
  assert.equal(Seq.lastLeft(["a", "x"], isIn), true);
  assert.equal(Seq.lastLeft(["x", "x"], isIn), true, "none left");
  assert.equal(Seq.lastLeft(["a", "b", "x"], isIn), false);
  assert.equal(Seq.lastLeft(["a"], isIn), false, "a game of one never ends for it");
});

test("a race and a cut: the first to N; the bottom N (or half) by a key, a tie kept or sent, never everyone", () => {
  const t = totals({ a: 12, b: 11.99, c: 3 });
  assert.equal(Seq.raceWon(["a", "b"], (id) => t.get(id), 12), true);
  assert.equal(Seq.raceWon(["b", "c"], (id) => t.get(id), 12), false, "only those who can finish it");
  const key = (pts) => (id) => [pts[id]];
  const keep = { out: 1, tie: "keep" };
  assert.deepEqual(Seq.cut(["a", "b", "c"], key({ a: 5, b: 2, c: 9 }), keep), ["b"]);
  assert.deepEqual(Seq.cut(["a", "b", "c"], key({ a: 5, b: 2, c: 2 }), keep), [], "a tie at the line keeps them");
  assert.deepEqual(Seq.cut(["a", "b", "c"], key({ a: 5, b: 2, c: 2 }), { out: 1, tie: "all" }), ["b", "c"], "or sends them all");
  assert.deepEqual(Seq.cut(["a", "b"], key({ a: 2, b: 2 }), { out: 1, tie: "all" }), [], "never everyone");
  assert.deepEqual(Seq.cut(["a", "b", "c", "d", "e"], key({ a: 1, b: 2, c: 3, d: 4, e: 5 }), { out: "half", tie: "keep" }), ["a", "b"]);
  assert.deepEqual(Seq.cut(["a", "b"], key({ a: 1, b: 2 }), { out: 5, tie: "keep" }), ["a"], "never more than all but one");
  assert.deepEqual(Seq.cut(["a"], key({ a: 1 }), keep), []);
  // A key compared from its first number on: the guillotine's window, then the total.
  assert.deepEqual(Seq.cut(["a", "b"], (id) => (id === "a" ? [1, 9] : [1, 4]), keep), ["b"]);
});

test("the cuts after an episode: every n by the window's points, an episode, before a phase; a quiet night skipped", () => {
  const run = (cuts, o) => {
    const out = new Map();
    const t = o.totals || totals({ a: 10, b: 6, c: 8 });
    Seq.cutsAfter(cuts, { k: o.k, start: 1, quiet: !!o.quiet, inAt: () => ["a", "b", "c"].filter((id) => !out.has(id)), total: (id) => t.get(id) || 0, before: () => o.before || null, out, phaseStarts: o.phaseStarts });
    return [...out];
  };
  const every2 = [{ at: { every: 2 }, out: 1, tie: "keep", quiet: "cut" }];
  assert.deepEqual(run(every2, { k: 1 }), [], "not its episode");
  // The guillotine: the lowest over the window (c gained 1, a 4, b 5), not the lowest total (b).
  assert.deepEqual(run(every2, { k: 2, before: totals({ a: 6, b: 1, c: 7 }) }), [["c", 2]]);
  assert.deepEqual(run([{ at: { episode: 3 }, out: 1, tie: "keep", quiet: "cut" }], { k: 3 }), [["b", 3]]);
  assert.deepEqual(run([{ at: { episode: 3 }, out: 1, tie: "keep", quiet: "skip" }], { k: 3, quiet: true }), [], "a quiet night skipped");
  assert.deepEqual(run([{ at: { episode: 3 }, out: 1, tie: "keep", quiet: "cut" }], { k: 3, quiet: true }), [["b", 3]], "or cut like any other");
  const phase = [{ at: { phase: "merged" }, out: 1, tie: "keep", quiet: "cut" }];
  assert.deepEqual(run(phase, { k: 4, phaseStarts: { merged: 5 } }), [["b", 4]], "after the episode before it starts");
  assert.deepEqual(run(phase, { k: 4 }), [], "not while data doesn't say where");
  // Two cuts after one episode, each on who's left then.
  assert.deepEqual(run([{ at: { episode: 3 }, out: 1, tie: "keep", quiet: "cut" }, { at: { episode: 3 }, out: 1, tie: "keep", quiet: "cut" }], { k: 3 }), [["b", 3], ["c", 3]]);
});

test("the knockouts' walk: a race ends it, the cuts fall, one left ends it; someone catching up or not started can't be cut", () => {
  const series = [1, 2, 3].map((n) => ({ number: n, quiet: false, totals: totals({ a: 4 * n, b: 3 * n, c: 2 * n, d: n }) }));
  const base = { start: 1, everyone: ["a", "b", "c", "d"], catching: new Set(), startOf: new Map(), race: null, cuts: [{ at: { every: 1 }, out: 1, tie: "keep", quiet: "cut" }], oneLeft: "ends", phaseStarts: {} };
  let w = Seq.knockouts(series, base);
  assert.deepEqual([...w.out], [["d", 1], ["c", 2], ["b", 3]]);
  assert.equal(w.ends, 3, "one left");
  assert.equal(Seq.knockouts(series, { ...base, oneLeft: "plays" }).ends, null, "it plays on");
  w = Seq.knockouts(series, { ...base, race: { to: 8 } });
  assert.deepEqual([w.ends, [...w.out]], [2, [["d", 1]]], "the race won after 2: no cut that night");
  // d still catching up is never cut; c, from Episode 3, can't be before it: after 1 a and b (b goes), after 2 a alone (no cut),
  // after 3 a and c (c goes). Two still in (a, and d catching up): it isn't over.
  w = Seq.knockouts(series, { ...base, catching: new Set(["d"]), startOf: new Map([["c", 3]]) });
  assert.deepEqual([[...w.out], w.ends], [[["b", 1], ["c", 3]], null]);
});

test("head to head's round robin, median and bracket", () => {
  assert.deepEqual(Seq.roundRobin(["a", "b", "c", "d"], 0), [["a", "d"], ["b", "c"]]);
  assert.deepEqual(Seq.roundRobin(["a", "b", "c", "d"], 1), [["a", "c"], ["d", "b"]]);
  assert.deepEqual(Seq.roundRobin(["a", "b", "c"], 0), [["a", null], ["b", "c"]], "an odd list leaves one out");
  assert.deepEqual(Seq.roundRobin(["a"], 0), []);
  assert.deepEqual(Seq.roundRobin(["a", "b", "c", "d"], 3), Seq.roundRobin(["a", "b", "c", "d"], 0), "the rounds turn");
  assert.equal(Seq.median([3, 1, 2]), 2);
  assert.equal(Seq.median([1.1, 2.2]), 1.65);
  assert.equal(Seq.median([]), 0);
  assert.deepEqual(Seq.bracket(4), [1, 4, 2, 3]);
  assert.deepEqual(Seq.bracket(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  // state-logic's are the sequence's.
  assert.deepEqual(S.MatchupLogic.round(["a", "b", "c"], 2), Seq.roundRobin(["a", "b", "c"], 2));
  assert.equal(S.MatchupLogic.median([4, 1]), Seq.median([4, 1]));
  assert.deepEqual(S.MatchupLogic.bracket(2), Seq.bracket(2));
});

test("head to head's walk: each week on what it added, an odd seat, a quiet night, the standings, the playoffs", () => {
  // Through each episode: a 5, 9, 9 (quiet), 14; b 3, 9, 9, 10; c 4, 4, 4, 9.
  const through = [{ a: 5, b: 3, c: 4 }, { a: 9, b: 9, c: 4 }, { a: 9, b: 9, c: 4 }, { a: 14, b: 10, c: 9 }];
  const series = through.map((t, i) => ({ number: i + 1, totals: totals(t) }));
  const sides = ["a", "b", "c"];
  const parts = { odd: "median", quiet: "skip", playoffs: null };
  const o = { parts, start: 1, from: null, finale: null, ended: false, sides, seatsAt: () => sides };
  let w = Seq.matchups(series, o);
  assert.deepEqual(w.weeks[0].games, [{ a: "a", b: null, aPoints: 5, bPoints: 3.5, result: "a" }, { a: "b", b: "c", aPoints: 3, bPoints: 4, result: "b" }], "a plays the median of the others");
  assert.equal(w.weeks[2].quiet, true);
  assert.ok(w.weeks[2].games.every((g) => g.result === null), "a quiet night counts for nobody");
  assert.deepEqual(Object.fromEntries([...w.records].map(([id, r]) => [id, [r.wins, r.losses, r.ties, r.for]])), { a: [3, 0, 0, 14], b: [1, 2, 0, 10], c: [2, 1, 0, 9] }, "a wins every week; c beats b twice and loses to a once");
  w = Seq.matchups(series, { ...o, parts: { ...parts, odd: "bye", quiet: "tie" } });
  assert.deepEqual(w.weeks[0].games[0], { a: "a", b: null, aPoints: 5, bPoints: null, result: null }, "a bye sits it out");
  assert.deepEqual(w.weeks[2].games.map((g) => [g.a, g.b, g.result]), [["a", "b", "tie"], ["c", null, null]], "a quiet night tied (the bye sits out)");
  assert.deepEqual(Seq.matchups(series, { ...o, parts: { ...parts, quiet: "tie" } }).weeks[2].games.map((g) => g.result), ["tie", "tie"], "the median's too");
  // Playoffs from episode 4, the top 2: seeded by the standings through 3, a tie to the better seed.
  const playoffs = { teams: 2, rounds: 1 };
  w = Seq.matchups(series, { ...o, parts: { ...parts, playoffs }, from: 4 });
  assert.deepEqual(w.seeds, ["a", "b"], "level on wins, b's points over c's");
  assert.equal(w.champion, "a");
  assert.deepEqual(Object.fromEntries(w.tiers), { a: 2, b: 1 });
  assert.equal(w.weeks.length, 3, "the playoffs' episodes aren't regular season");
  // Not seeded until every episode before them has been played; the season over first: the standings as they are, the best seed in.
  assert.equal(Seq.matchups(series.slice(0, 2), { ...o, parts: { ...parts, playoffs }, from: 4 }).seeds, null);
  w = Seq.matchups(series.slice(0, 3), { ...o, parts: { ...parts, playoffs }, from: 5, finale: 3, ended: true });
  assert.deepEqual([w.seeds, w.champion], [["a", "b"], "a"], "the season over with rounds to play: the best seed still in");
  // Four seeds of a field of three: the top seed's bye; the quiet night's tie to the better seed (b over c).
  w = Seq.matchups(series, { ...o, parts: { ...parts, playoffs: { teams: 4, rounds: 2 } }, from: 3 });
  assert.deepEqual(w.rounds[0].games.map((g) => [g.aSeed, g.bSeed, g.winner]), [[1, null, "a"], [2, 3, "b"]]);
});

test("a team's step (summed or the mean) and co-op's night (one, most, all)", () => {
  const run = new Map([["t1", 1], ["t2", 0], ["t3", 2]]);
  Seq.teamStep(run, new Map([["t1", [1.1, 2.2]], ["t2", [3]]]), "mean");
  assert.deepEqual(Object.fromEntries(run), { t1: 2.65, t2: 3, t3: 2 }, "a team nobody's on that episode adds nothing");
  Seq.teamStep(run, new Map([["t1", [1.1, 2.2]]]), "sum");
  assert.equal(run.get("t1"), 5.95);
  assert.equal(Seq.saved(3, 1, "one"), true);
  assert.equal(Seq.saved(3, 0, "one"), false);
  assert.equal(Seq.saved(4, 2, "most"), false, "more than half");
  assert.equal(Seq.saved(4, 3, "most"), true);
  assert.equal(Seq.saved(3, 3, "all"), true);
  assert.equal(Seq.saved(0, 0, "all"), false, "a night nobody answered costs one");
});

test("6. the keys: last one standing (in, then out later first, a shared win tied), head to head's record", () => {
  const rows = [{ id: "out3", out: 3, total: 9 }, { id: "in", out: null, total: 1, lives: 1 }, { id: "out5", out: 5, total: 0 }, { id: "in2", out: null, total: 1, lives: 2 }];
  assert.deepEqual(Seq.byKey(rows.slice(), Seq.standingKey).map((r) => r.id), ["in2", "in", "out5", "out3"]);
  assert.deepEqual(Seq.standingKey({ out: 4, total: 7, shared: true }), [0, 4, 0], "those sharing the win tie");
  assert.deepEqual(S.PickEmScoringStrategy.standingKey({ out: null, total: 2, lives: 1 }), Seq.standingKey({ out: null, total: 2, lives: 1 }));
  assert.deepEqual(Seq.recordKey({ tier: 2, wins: 3, ties: 1, for: 20.5, seed: 2 }), [2, 7, 20.5, -2]);
  assert.deepEqual(Seq.recordKey({ tier: 0, wins: 0, ties: 0, for: 0, seed: null }), [0, 0, 0, 0]);
});
