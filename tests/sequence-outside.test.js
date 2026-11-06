// The scoring sequence outside the state (docs/PLAN-start-a-game-gpt.md track C, C2 part 3; src/lib/game/sequence/): what the
// server scores from what only it holds, each a pure step with data in and out. A game of questions' window: its lines (each
// answer's right ones at what the window is worth to it), a shrinking call's worth, a rollover's jackpot and what it carries, a pot
// split, only the only one right (alone, and by pick); its walk on its series as a draft's is (the knockouts with a night's lives
// lost, worked out as the walk goes; co-op's lives together); Weekly Calls' right calls and bingo's lines counted (tally), their
// running count through each episode (through) and a line's points on it. Each piece agrees with the code it replaced (kept here as
// it was, on many made-up windows); every game scoring through them as before is tests/sequence-agree.test.js (the shapes from
// q-plain on: a game of questions with every combiner and walk, Weekly Calls, bingo, a game in stages). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Seq = require("../src/lib/game/sequence/index.js");
const G = require("../src/lib/game/game-spec/index.js");

const M = (o) => new Map(Object.entries(o));
const obj = (m) => Object.fromEntries(m);

/** A small seeded random (the same windows every run). */
function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

// ---- before C2 part 3, as game-spec answers.js windowPoints combined a window's units (kept to compare) ----
const cents = (n) => Math.round(n * 100) / 100;
function oldSplit(worth, units) {
  const out = new Map();
  const right = [...units].filter(([, u]) => u > 0);
  const total = right.reduce((n, [, u]) => n + u, 0);
  for (const [pid, u] of right) out.set(pid, cents((worth * u) / total));
  return out;
}
function oldOnly(worth, units) {
  const out = new Map();
  const right = [...units].filter(([, u]) => u > 0);
  if (right.length === 1) out.set(right[0][0], right[0][1] * worth);
  return out;
}
function oldLines(units, worthOf) {
  const out = new Map();
  for (const [pid, u] of [...units].filter(([, x]) => x > 0)) {
    const n = u * worthOf(pid);
    if (n) out.set(pid, n);
  }
  return out;
}

test("a window's lines: each answer's right ones at what the window is worth to it; nothing right, or worth nothing, no line", () => {
  assert.deepEqual(obj(Seq.windowLines(M({ ann: 1, bo: 0, cy: 2 }), () => 3)), { ann: 3, cy: 6 });
  assert.deepEqual(obj(Seq.windowLines(M({ ann: 1, bo: 1 }), (p) => (p === "bo" ? 0 : 10))), { ann: 10 }, "a shrinking call worth nothing by now");
  assert.deepEqual([...Seq.windowLines(M({ cy: 1, ann: 2 }), () => 1).keys()], ["cy", "ann"], "in the units' order");
  assert.deepEqual(obj(Seq.windowLines(M({ ann: NaN, bo: -1 }), () => 1)), {}, "nothing that isn't a right one");
});

test("a shrinking call's worth: less per episode late or change, never below nothing", () => {
  assert.equal(Seq.shrink(10, 1, 3), 7);
  assert.equal(Seq.shrink(10, 2, 0), 10);
  assert.equal(Seq.shrink(10, 1, 12), 0);
  assert.equal(Seq.shrink(5, 0.5, 3), 3.5);
  // The grader's own reads it (answers.js shrunk: a question's shrink and each answer's late or changes).
  const WIN = { id: "win", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "winner" } };
  assert.equal(G.shrunk(WIN, 10, { late: 4 }), 6);
  assert.equal(G.shrunk({ ...WIN, shrink: { points: 1, per: "change" } }, 10, { changes: 11 }), 0);
});

test("a rollover: its points with what the windows before carried; a window anyone scored on carries nothing, else all of it", () => {
  assert.equal(Seq.jackpot(2, 0), 2);
  assert.equal(Seq.jackpot(2, 4), 6);
  assert.equal(Seq.carry(6, M({ ann: 0 })), 6, "nobody scored: it rolls on");
  assert.equal(Seq.carry(6, new Map()), 6, "nobody answered: it rolls on too");
  assert.equal(Seq.carry(6, M({ ann: 0, bo: 2 })), 0);
  // Three windows: nobody, nobody, then bo: the third is worth three windows' points.
  let carried = 0;
  const worths = [];
  for (const got of [M({}), M({ ann: 0 }), M({ bo: 6 })]) {
    const w = Seq.jackpot(2, carried);
    worths.push(w);
    carried = Seq.carry(w, got);
  }
  assert.deepEqual([worths, carried], [[2, 4, 6], 0]);
});

test("a pot split: the worth between everyone right by their units, each share to the cent", () => {
  assert.deepEqual(obj(Seq.split(10, M({ ann: 1, bo: 1, cy: 1 }))), { ann: 3.33, bo: 3.33, cy: 3.33 });
  assert.deepEqual(obj(Seq.split(10, M({ ann: 6, bo: 10, cy: 0 }))), { ann: 3.75, bo: 6.25 }, "by units (chips): nobody with none");
  assert.deepEqual(obj(Seq.split(10, M({}))), {}, "nobody right: nobody's");
});

test("only the only one right: alone, their units at the worth; by pick, each right pick one alone named", () => {
  assert.deepEqual(obj(Seq.only(2, M({ ann: 1, bo: 0 }))), { ann: 2 });
  assert.deepEqual(obj(Seq.only(2, M({ ann: 1, bo: 1 }))), {}, "two right: nobody");
  assert.deepEqual(obj(Seq.only(3, M({ cy: 2 }))), { cy: 6 });
  // ann alone on c6, bo and ann both on c9, di alone on c1 and on c10: ann 2, di 4.
  assert.deepEqual(obj(Seq.onlyEach(2, M({ c6: ["ann"], c9: ["ann", "bo"], c1: ["di"], c10: ["di"] }))), { ann: 2, di: 4 });
  assert.deepEqual(obj(Seq.onlyEach(2, new Map())), {});
});

test("the window's pieces agree with the combining they replaced, on many made-up windows", () => {
  const next = rng(31);
  const seats = ["ann", "bo", "cy", "di", "ed"];
  for (let i = 0; i < 2000; i++) {
    const units = new Map(seats.filter(() => next() < 0.8).map((p) => [p, Math.floor(next() * 4) * (next() < 0.1 ? 1.5 : 1)]));
    const worth = [1, 2, 3, 5, 7, 10, 0.5, 13][Math.floor(next() * 8)] + (next() < 0.3 ? Math.floor(next() * 9) : 0);
    const late = new Map(seats.map((p) => [p, Math.floor(next() * 6)]));
    const worthOf = (p) => Seq.shrink(worth, 1, late.get(p));
    assert.deepEqual([...Seq.split(worth, units)], [...oldSplit(worth, units)], `split ${i}`);
    assert.deepEqual([...Seq.only(worth, units)], [...oldOnly(worth, units)], `only ${i}`);
    assert.deepEqual([...Seq.windowLines(units, worthOf)], [...oldLines(units, (p) => Math.max(0, worth - late.get(p)))], `lines ${i}`);
  }
});

test("each piece changed is caught: the split's rounding, only's count, a rollover's carry, the lines' filter", () => {
  // The shapes fixture's reads catch each of these (tests/sequence-agree.test.js); here, the pieces' own behaviour pinned.
  assert.notDeepEqual(obj(Seq.split(10, M({ ann: 1, bo: 2 }))), { ann: 10 / 3, bo: 20 / 3 }, "rounded to the cent");
  assert.equal(obj(Seq.split(10, M({ ann: 1, bo: 2 }))).bo, 6.67);
  assert.notEqual(Seq.carry(4, M({ ann: 0.5 })), 4, "any points at all claim it");
  assert.equal(Seq.jackpot(2, 4) - Seq.jackpot(2, 0), 4);
});

// ---- the walk: the knockouts with lives, worked out as it goes; co-op ----
const base = (more = {}) => ({ start: 1, everyone: ["ann", "bo", "cy"], catching: new Set(), startOf: new Map(), race: null, cuts: [], oneLeft: null, phaseStarts: null, ...more });

test("lives lost: none left goes out; everyone left the same night comes back, shares it or goes out as anyone", () => {
  const night = (lives, lost, allOut, left = ["ann", "bo", "cy"], ids = left) => {
    const L = M(lives);
    const out = new Map();
    const shared = new Set();
    Seq.livesNight(L, M(lost), { k: 4, ids, left, out, shared, allOut });
    return { lives: obj(L), out: obj(out), shared: [...shared] };
  };
  assert.deepEqual(night({ ann: 2, bo: 1, cy: 1 }, { ann: 1, bo: 1 }, "points"), { lives: { ann: 1, bo: 0, cy: 1 }, out: { bo: 4 }, shared: [] });
  assert.deepEqual(night({ ann: 1, bo: 1, cy: 1 }, { ann: 1, bo: 1, cy: 1 }, "back"), { lives: { ann: 1, bo: 1, cy: 1 }, out: {}, shared: [] }, "all back");
  assert.deepEqual(night({ ann: 1, bo: 1, cy: 1 }, { ann: 1, bo: 1, cy: 1 }, "share"), { lives: { ann: 0, bo: 0, cy: 0 }, out: { ann: 4, bo: 4, cy: 4 }, shared: ["ann", "bo", "cy"] });
  assert.deepEqual(night({ ann: 1, bo: 1, cy: 1 }, { ann: 1, bo: 1, cy: 1 }, "points"), { lives: { ann: 0, bo: 0, cy: 0 }, out: { ann: 4, bo: 4, cy: 4 }, shared: [] });
  assert.deepEqual(night({ ann: 3, bo: 1 }, { ann: 2, bo: 1 }, "share", ["ann", "bo"]), { lives: { ann: 1, bo: 0 }, out: { bo: 4 }, shared: [] }, "one of two: not everyone");
  // Someone still catching up isn't among who could lose one, so the night isn't everyone's.
  assert.deepEqual(night({ ann: 1, bo: 1, cy: 1 }, { ann: 1, bo: 1 }, "back", ["ann", "bo", "cy"], ["ann", "bo"]), { lives: { ann: 0, bo: 0, cy: 1 }, out: { ann: 4, bo: 4 }, shared: [] });
});

test("the knockouts on a series worked out as it goes: who's out so far reaches each night's totals and lives", () => {
  const seen = [];
  // Each night's totals: 2 points a night to whoever isn't out (someone out takes no share after).
  const nights = [1, 2, 3, 4].map((k) => ({
    number: k,
    quiet: false,
    totals: (out) => { seen.push([k, [...out.keys()]]); return new Map(["ann", "bo", "cy"].map((p) => [p, out.has(p) ? (out.get(p) < k ? 4 : 2 * k) : 2 * k])); },
    lives: (ids) => new Map(ids.filter((p) => (k === 2 && p === "cy") || (k === 3 && p === "bo")).map((p) => [p, 1])),
  }));
  const r = Seq.knockouts(nights, base({ lives: { of: 1, allOut: "points" }, oneLeft: "ends" }));
  assert.deepEqual(obj(r.out), { cy: 2, bo: 3 });
  assert.equal(r.ends, 3, "one left ends it");
  assert.deepEqual(obj(r.lives), { ann: 1, bo: 0, cy: 0 });
  assert.deepEqual(seen, [[1, []], [2, []], [3, ["cy"]]], "each night read with who was out before it");
  assert.deepEqual(r.walked.map((x) => x.number), [1, 2, 3]);
  // A race before the lives: won on the night, nobody loses one there.
  const raced = Seq.knockouts(nights.map((n) => ({ ...n })), base({ lives: { of: 1, allOut: "points" }, race: { to: 4 } }));
  assert.deepEqual([raced.ends, obj(raced.out)], [2, {}]);
  // A draft's series (plain totals, no lives) reads as before: no lives, nobody shares.
  const plain = Seq.knockouts([{ number: 1, quiet: false, totals: M({ ann: 1, bo: 2, cy: 3 }) }], base({ cuts: [{ at: { every: 1 }, out: 1, tie: "keep", quiet: "cut" }] }));
  assert.deepEqual([obj(plain.out), plain.lives, [...plain.shared]], [{ ann: 1 }, null, []]);
});

test("co-op on its series: the couch's lives together, a life for each question it lost, over at none", () => {
  const night = (k, missed) => ({ number: k, quiet: false, totals: (out) => { assert.equal(out.size, 0, "nobody is out in co-op"); return M({ ann: k }); }, missed: (out) => { assert.equal(out.size, 0); return missed; } });
  const won = Seq.coop([night(1, []), night(2, ["boot"]), night(3, [])], { lives: 2 });
  assert.deepEqual([won.lives, won.lost, won.ends, won.walked.length], [1, [{ episode: 2, question: "boot" }], null, 3]);
  const lost = Seq.coop([night(1, ["boot", "idol"]), night(2, [])], { lives: 2 });
  assert.deepEqual([lost.lives, lost.ends, lost.walked.length], [0, 1, 1], "over the night the last went");
});

// ---- Weekly Calls' and bingo's counts ----

test("right calls and bingo lines counted: each one's, in order, and each episode's too; a card with none isn't a line", () => {
  const byEpisode = new Map();
  const lines = [
    { id: "u1", episode: 2, n: 1 },
    { id: "u2", episode: 1, n: 2 },
    { id: "u1", episode: 2, n: 1 },
    { id: "u3", episode: 3, n: 0 },
    { id: "u1", episode: 4, n: 3 },
  ];
  const out = Seq.tally(lines, byEpisode);
  assert.deepEqual([...out], [["u1", 5], ["u2", 2]]);
  assert.deepEqual([...byEpisode].map(([e, m]) => [e, [...m]]), [[2, [["u1", 2]]], [1, [["u2", 2]]], [4, [["u1", 3]]]]);
  assert.deepEqual([...Seq.tally(lines)], [["u1", 5], ["u2", 2]], "without a count by episode");
});

test("a count through each episode: the running total from the game's start, whole; and a line's points on it", () => {
  const byEpisode = new Map([[1, M({ u1: 2 })], [3, M({ u2: 1, u1: 1 })], [5, M({ u3: 4 })]]);
  const t = Seq.through(byEpisode, 2, 4);
  assert.deepEqual([...t].map(([e, m]) => [e, obj(m)]), [[2, {}], [3, { u2: 1, u1: 1 }], [4, { u2: 1, u1: 1 }]], "from its start: Episode 1's before it");
  assert.deepEqual([...Seq.through(byEpisode, 3, 2)], [], "a game that hasn't started");
  assert.equal(Seq.counted(3, 2), 6, "three lines at two points");
  assert.equal(Seq.counted(3, 0.333), 3 * 0.333, "never rounded");
  // As answer-points.ts outsideCounts added them up before (kept to compare), on many made-up counts.
  const next = rng(7);
  for (let i = 0; i < 300; i++) {
    const by = new Map();
    for (let e = 1; e <= 8; e++) if (next() < 0.7) by.set(e, new Map(["a", "b", "c"].filter(() => next() < 0.5).map((u) => [u, 1 + Math.floor(next() * 3)])));
    const from = 1 + Math.floor(next() * 4);
    const upTo = Math.floor(next() * 9);
    const old = new Map();
    const run = new Map();
    for (let e = from; e <= upTo; e++) {
      for (const [u, k] of by.get(e) ?? []) run.set(u, (run.get(u) ?? 0) + k);
      old.set(e, new Map(run));
    }
    assert.deepEqual([...Seq.through(by, from, upTo)].map(([e, m]) => [e, [...m]]), [...old].map(([e, m]) => [e, [...m]]), `through ${i}`);
  }
});
