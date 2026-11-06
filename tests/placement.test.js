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

/** A moved verdict that loses only its problem: the same shape, the same waits. */
const only = (was) => `${was[0]}-${was[2]}`;
/** The combinations C2 part 4 opens, by the corpus' names (hold|score|rank|ask), each with the verdict a spec it moves has now
 *  (`to`: from its verdict before, its name, and any spec's verdict now by name). */
const OPENED = [
  // A draft's own questions beyond its finale predictions (part 4c: the answers' lines join the draft's): it reads as the same game
  // asking nothing, but for a question's own problem (a wager plays alone) and its cuts or a race (no place yet: who's out decides the
  // moves its own writes take, which read it as stored). Before the teams' openings below, which some of these are too.
  { why: "a draft's own questions beyond its finale predictions", test: (n) => /^(snake|blind|draw|auction|market)-[^|]+\|(place|place-rev|moments[^|]*)\|[^|]+\|/.test(n) && !/\|(none|finale|calls|calls-boot)$/.test(n),
    to: (was, n, now) => {
      const twin = now(n.replace(/[^|]+$/, "none"));
      const ask = n.split("|")[3];
      if (/^[^|]+\|[^|]+\|(standing-cut|total-race|matchups-race)/.test(n)) return `.${twin[1]}w`;
      // C6: a wager with a share or a rollover plays now (its stake a line of its own), so it reads as the game asking nothing.
      return twin;
    } },
  { why: "a game in stages with a stage of a draft asking its own questions", test: (n) => /^stages\|(draft-questions\|[^|]+|[^|]+\|draft-questions)$/.test(n), to: () => "s--" },
  // A shrinking call that's shared (part 4a): each right call at what it was worth when it was made, then shared.
  { why: "a shrinking call that's shared", test: (n) => /\|(winner-shrink-split|winner-shrink-only|winner-shrink-change-split|shrink-split-second|shrink-only-second)$/.test(n), to: only },
  // A parlay whose legs roll over, shrink or pay only the only one right (part 4a): multiplied as each stands.
  { why: "a parlay's leg that rolls over or pays only the only one right", test: (n) => /^[^|]+\|answers-parlay\|[^|]+\|(rollover-imm|only-imm)$/.test(n), to: only },
  { why: "a parlay's leg that shrinks", test: (n) => /^[^|]+\|answers-parlay-once\|[^|]+\|(shrink-second|shrink-only-second)$/.test(n), to: only },
  // A pool ranked by its points, head to head, in teams or with a handicap (part 4b: its series of totals, from its picks): one
  // asking nothing beside its picks plays as a pool; one with questions beside them still waits for them (a stage alongside).
  { why: "a pool ranked by its points, head to head, in teams or with a handicap", test: (n) => /^pick(-never)?\|survive(-scores)?\|(total|total-teams|total-hc|matchups|matchups-po|matchups-teams|matchups-hc)\|/.test(n), to: (was, n) => (n.endsWith("|none") ? "p--" : only(was)) },
  { why: "a game in stages with a stage of a pool ranked by its points", test: (n) => /^stages\|(pool-total\|[^|]+|[^|]+\|pool-total)$/.test(n), to: () => "s--" },
  // Teams of players knocked out by a draft's cuts, or racing (part 4b: the week's result on the teams' totals).
  { why: "a draft's teams knocked out by its cuts, or racing", test: (n) => /^(snake|blind|draw|auction|market)-[^|]+\|[^|]+\|(standing-cut-teams|total-race-teams)\|/.test(n), to: only },
  // C5: a pick each episode, one or several, cycling or never repeating, scored by what they do, ranked by its points or head to head
  // (in teams, with a handicap): asking nothing beside it, it plays as a pick's game (a captain is a lineup's: still a problem); with
  // questions beside it, only they wait (a stage alongside), as beside a pool.
  { why: "a pick each episode, one or several, scored by what they do", test: (n) => /^pick(-never|-two)?\|moments(-cap|-times)?\|(total|total-teams|total-hc|matchups|matchups-po|matchups-teams|matchups-hc)\|/.test(n),
    to: (was, n) => (n.endsWith("|none") ? (n.includes("|moments-cap|") ? "pp-" : "p--") : ".-w") },
  // C6, money: a stake beside a share or a rollover, and a parlay's staked leg (the stake a line of its own; a parlay multiplies it
  // with the leg's points): each loses only its problem ("A wager plays alone", "a parlay's legs aren't staked").
  { why: "a stake beside a share, a rollover or a parlay", test: (n) => /\|(idol-wager-split|idol-wager-rollover|wager-imm)$/.test(n),
    // (On the sports branch one ranked roto keeps the roto's refusal, L4 part 1b's CLOSED below.)
    to: (was, n) => (/^[^|]+\|[^|]+\|roto\|/.test(n) ? `${was[0]}p${was[2]}` : only(was)) },
  // (C5 also opened two picks each episode ranked roto, to a wait alone: on the sports branch a rank by roto on no categories is
  // refused, L4 part 1b's CLOSED below, so they stay as they were.)
];

/** What track L refuses that only waited before, the same wait with a problem: a rank by roto on anything but a sport's categories
 *  (L4 part 1b, schema.js categoryProblems: score.by 'stats' with categories); squares scored by anything but their squares (L4
 *  part 2, squaresProblems: score.by 'squares', which the corpus never says; scoring by stats, which the check took beside squares
 *  before, needs a draft or a pick). */
const CLOSED = [
  { why: "a rank by roto on no categories", test: (n) => /^[^|]+\|[^|]+\|roto\|/.test(n), to: (was) => `${was[0]}p${was[2]}` },
  { why: "squares scored by anything but their squares", test: (n) => /^squares\|/.test(n), to: (was) => `${was[0]}p${was[2]}` },
];

test("the placement corpus: every verdict as the seven shapes gave it, but the combinations part 4 opens", () => {
  const list = C.corpus();
  const was = C.record();
  assert.equal(was.length, list.length, "the record covers the corpus (remake it only before an opening, saying so)");
  const now = C.verdicts(G);
  const at = new Map(list.map(([name], i) => [name, i]));
  const nowOf = (name) => now[at.get(name)];
  const moved = [];
  list.forEach(([name], i) => {
    if (now[i] === was[i]) return;
    const open = OPENED.find((o) => o.test(name)) || CLOSED.find((o) => o.test(name));
    assert.ok(open, `${name}: ${was[i]} -> ${now[i]}, and part 4 opens nothing there`);
    // Its refusal is lifted, nothing else (or, where nothing else holds it back, it plays).
    assert.equal(now[i], open.to(was[i], name, nowOf), `${name}: ${open.why}`);
    moved.push(i);
  });
  // Each opening moves something (the corpus reaches it).
  for (const o of [...OPENED, ...CLOSED]) assert.ok(moved.some((i) => o.test(list[i][0])), `the corpus reaches ${o.why}`);
  // Part 4a's 169 (a game of questions' combinations), part 4b's 770: 150 play now (28 pools by their points, 14 games in stages
  // with a stage of one, 108 drafts whose teams are knocked out or race), and 620 lose only a problem while something else still
  // waits (questions beside a pool or a draft, a count that doesn't fit, a sport's piece). Part 4c's 854 (against part 4b's engine; 35
  // of them part 4b had moved already, so 819 more here): 744 play now (728 drafts asking their own questions, 16 games in stages with
  // a stage of one), and 110 lose only a wait or a problem while something else still holds them back (a count that doesn't fit, a
  // captain on best ball, a market's own problem, a wager with a share, their cuts or a race). C5's 225: a pick each episode, one
  // or two, scored by what they do: 42 play now (asking nothing, ranked by its points or head to head, in teams or with a
  // handicap), 21 a captain still refuses (a lineup's), and 162 lose only a problem while their questions (a stage alongside) or
  // a sport's rank still wait (on the sports branch 215: its 10 ranked roto stay refused, above). L4 part 1b's 354: a rank by
  // roto on a show's game refused, as well as waiting for the sports branch (375 in all, 21 of them a draft's own questions part
  // 4c had moved already, each refused the same way its twin asking nothing is). L4 part 2's 15: squares scored by moments (five
  // of them multiplied in the finale) or stats and ranked by the total, refused as well as waiting (the rest of the corpus'
  // squares had a problem already). C6's 73: a stake beside a share or a rollover, and a parlay's staked leg: 40 play
  // now (games of questions), and 33 lose only their problem while something else still holds them back (a sport's rank, questions
  // beside a pool); 66 more here, the other 7 ranked roto, which L4 part 1b's 354 had moved already (they keep its refusal).
  assert.equal(moved.length, 169 + 770 + 819 + 215 + 354 + 15 + 66);
  // What plays: 933 before part 4, and every opening that plays now (none played before: each had a problem or a wait).
  assert.ok(moved.every((i) => !C.plays(was[i])));
  assert.equal(now.filter(C.plays).length, 933 + moved.filter((i) => C.plays(now[i])).length);
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
  // C5: a pick each episode scored by what they do plays (it was refused: "picks scored by what they do come with C5").
  assert.equal(G.typeOf({ ...P["survival-pool"], score: { by: "moments", points: null }, rank: { by: "total" } }), "pickem");
  // C2 part 4c: a draft's own questions play beside it, but not a stake of any of your points (a game of questions', C6), beside its cuts or a race,
  // or beside a stock market ranked by its worth.
  assert.deepEqual([G.typeOf({ ...P.outlast, ask: [boot] }), G.typeOf({ ...P["weekly-lineup"], ask: [boot] })], ["classic-draft", "active-roster"]);
  one({ ...P.outlast, ask: [{ ...boot, wager: "total" }] }, "ask[0].wager", "staking any of your points is a game of questions'");
  one({ ...P.outlast, rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1 }] }, ask: [...G.finaleQuestions({ top3: 1, winner: 3, from: "any" }), boot] }, "ask", "a draft's own questions can't go beside its cuts or a race yet");
  one({ get: { by: "draft", each: 5, order: "blind", own: "shared", budget: { total: 100, floor: 5, ceiling: 25, trade: { fee: 0 } } }, count: { start: 3 }, score: { by: "moments", points: null }, rank: { by: "worth" }, ask: [boot] }, "ask", "a stock market ranks by its worth");
  one({ ...P["survival-pool"], ask: [boot] }, "ask", "a pool's picks are its game");
  one({ ...P["weekly-bingo"], ask: [boot] }, "ask", "a bingo card is its game");
  // Steps 5 and 6: the rank on what the lines make.
  // C2 part 4b: a pool plays by its points, but not with lives (they knock players out).
  one({ ...P["survival-pool"], score: { ...P["survival-pool"].score, lives: 2 }, rank: { by: "total" } }, "rank.by", "a pool with lives knocks players out");
  // A game in stages: each stage's own, where it is.
  const staged = { get: { by: "none" }, count: null, score: { by: "stages" }, rank: { by: "total" }, ask: [], overall: { by: "points" },
    stages: [{ id: "a", name: null, game: { ...P.outlast, span: { from: 1, to: 5 } } }, { id: "b", name: null, game: { ...P.outlast, span: { from: 6, to: null }, ask: [{ ...boot, wager: "total" }] } }] };
  one(staged, "stages[1].game.ask[0].wager", "staking any of your points is a game of questions'");
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
