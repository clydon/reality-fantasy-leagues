// Playing by placement (docs/PLAN-start-a-game-gpt.md track C, C2 part 4): a spec plays when each piece it names has its place in
// the scoring sequence (game-spec schema.js unplaced: what's held, its lines, the questions beside them, the week's result and the
// rank), not when it matches one of seven shapes; the shape it plays as (typeOf) is still named for the screens (shapeOf). Proven on
// the placement corpus (tests/fixtures/placement-corpus.js: 56,025 specs, every way of holding, scoring, ranking and asking crossed,
// games in stages, and the parts every game shares), each verdict as the seven shapes gave it before part 4 (placement-corpus.json, 6b8b1269's engine) except the
// combinations part 4 opens, each listed with why. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../src/lib/game/game-spec/index.js");
const C = require("./fixtures/placement-corpus.js");

/** The combinations C2 part 4 opens, by the corpus' names (hold|score|rank|ask): each moved verdict loses only its problem. */
const OPENED = [
  // A shrinking call that's shared (part 4a): each right call at what it was worth when it was made, then shared.
  { why: "a shrinking call that's shared", test: (n) => /\|(winner-shrink-split|winner-shrink-only|winner-shrink-change-split|shrink-split-second|shrink-only-second)$/.test(n) },
  // A parlay whose legs roll over, shrink or pay only the only one right (part 4a): multiplied as each stands.
  { why: "a parlay's leg that rolls over or pays only the only one right", test: (n) => /^[^|]+\|answers-parlay\|[^|]+\|(rollover-imm|only-imm)$/.test(n) },
  { why: "a parlay's leg that shrinks", test: (n) => /^[^|]+\|answers-parlay-once\|[^|]+\|(shrink-second|shrink-only-second)$/.test(n) },
];

test("the placement corpus: every verdict as the seven shapes gave it, but the combinations part 4 opens", () => {
  const list = C.corpus();
  const was = C.record();
  assert.equal(was.length, list.length, "the record covers the corpus (remake it only before an opening, saying so)");
  const now = C.verdicts(G);
  const moved = [];
  list.forEach(([name], i) => {
    if (now[i] === was[i]) return;
    const open = OPENED.find((o) => o.test(name));
    assert.ok(open, `${name}: ${was[i]} -> ${now[i]}, and part 4 opens nothing there`);
    // Its refusal is lifted, nothing else: the same shape, the same waits.
    assert.equal(now[i], `${was[i][0]}-${was[i][2]}`, `${name}: only its problem goes (${open.why})`);
    moved.push(name);
  });
  // Each opening moves something (the corpus reaches it), and it's every spec of it that had only that problem.
  for (const o of OPENED) assert.ok(moved.some(o.test), `the corpus reaches ${o.why}`);
  assert.equal(moved.length, 169);
  // What plays: 933 before part 4, and the openings that play now (a game of questions; beside a draft or a pool they still wait).
  assert.equal(now.filter(C.plays).length, 933 + moved.filter((n) => now[list.findIndex(([x]) => x === n)][0] === "q").length);
});

test("a piece with no place says which, and why", () => {
  const P = G.PRESETS;
  const boot = { id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
  const waits = (spec) => G.specWaitsFor(spec).map((w) => [w.at, w.step, w.problem]);
  const one = (spec, at, why) => {
    const w = waits(spec);
    assert.equal(w.length, 1, JSON.stringify(w));
    assert.equal(w[0][0], at);
    assert.equal(w[0][1], null);
    assert.match(w[0][2], new RegExp(`^No game plays this way yet: ${why}`));
    assert.equal(G.typeOf(spec), null);
    assert.deepEqual(G.specProblems(spec, null), [], "nothing else against it");
  };
  // Step 2: the lines and what they need held, and the questions beside them.
  one({ ...P["weekly-lineup"], count: { all: true } }, "count", "scoring by moments counts a lineup");
  one({ ...P["survival-pool"], score: { by: "moments", points: null }, rank: { by: "total" } }, "score.by", "a pick each episode scores by staying in .* C5");
  one({ ...P.outlast, ask: [boot] }, "ask", "a draft's own questions beyond its finale predictions");
  one({ ...P["weekly-lineup"], ask: [boot] }, "ask", "a draft's own questions");
  one({ ...P["survival-pool"], ask: [boot] }, "ask", "a pool's picks are its game");
  one({ ...P["weekly-bingo"], ask: [boot] }, "ask", "a bingo card is its game");
  // Steps 5 and 6: the rank on what the lines make.
  one({ ...P["survival-pool"], rank: { by: "total" } }, "rank.by", "a pool ranks by its streak, or last one standing");
  // A game in stages: each stage's own, where it is.
  const staged = { get: { by: "none" }, count: null, score: { by: "stages" }, rank: { by: "total" }, ask: [], overall: { by: "points" },
    stages: [{ id: "a", name: null, game: { ...P.outlast, span: { from: 1, to: 5 } } }, { id: "b", name: null, game: { ...P.outlast, span: { from: 6, to: null }, ask: [boot] } }] };
  one(staged, "stages[1].game.ask", "a draft's own questions");
  // A piece still to build is its step's, never "no game plays this way".
  assert.deepEqual(waits({ ...P.outlast, closes: "daily" }).map(([at, step]) => `${at}:${step}`), ["closes:sports"]);
});

test("each shape is still named for the screens, from its lines", () => {
  const P = G.PRESETS;
  const shapes = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, G.typeOf(p)]));
  assert.deepEqual(shapes, { outlast: "classic-draft", "weekly-lineup": "active-roster", "survival-pool": "pickem", "weekly-calls": "weekly-calls", "weekly-bingo": "weekly-bingo" });
  assert.equal(G.typeOf({ get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask: [{ id: "w", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } }] }), "questions");
  assert.equal(G.typeOf({ ...P["weekly-lineup"], count: { best: 3 } }), "active-roster", "best ball");
  assert.equal(G.typeOf({ ...P.outlast, rank: { by: "matchups" } }), "classic-draft", "head to head on an Outlast");
  assert.equal(G.typeOf({ get: { by: "none" }, count: null, score: { by: "stages" }, rank: { by: "total" }, ask: [], overall: { by: "points" }, stages: [{ id: "a", name: null, game: { ...P.outlast, span: { from: 1, to: 5 } } }, { id: "b", name: null, game: { ...P["survival-pool"], span: { from: 6, to: null } } }] }), "stages");
  // playsAs on a whole spec is typeOf's, and a non-object plays nothing.
  assert.equal(G.playsAs(G.fullSpec(P.outlast)), "classic-draft");
  assert.equal(G.playsAs(null), null);
});
