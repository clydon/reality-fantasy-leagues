// A shrinking call that's shared (docs/PLAN-start-a-game-gpt.md track C, C2 part 4a: a combination the scoring sequence opens): each
// right call at what it was worth when it was made (step 2: the shrink), then shared (step 4): a split, each one's worth divided
// between everyone right by their right ones (one right alone keeps what its call is worth; calls worth the same split it as a pot);
// only the only one right, keeping theirs (on a pick of several, each right pick nobody else named). Its shape, its grading on facts
// and through the engine, and its words; every number here worked out by hand. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Seq = require("../src/lib/game/sequence/index.js");

const WIN = { id: "win", ask: "Who wins?", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "winner" } };
const POT = { ...WIN, id: "pot", ask: "Who wins? A pot, split", share: "split" };
const ALONE = { ...WIN, id: "alone", ask: "Who wins? Only if you're the only one", share: "only" };
const SEAL = { ...POT, id: "seal", ask: "Who wins? A pot, every change a point", shrink: { points: 1, per: "change" } };
const TOP = { id: "top", ask: "Who makes the final three?", answer: "person", pick: 3, points: 10, closes: "finale", share: "only", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "top", place: 3 } };
const game = (ask) => ({ spec: 1, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask });
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: true, jury: true, phases: [] };

test("its shape: a shrinking call shares a pot, or pays only the only one right", () => {
  for (const q of [POT, ALONE, SEAL, TOP]) {
    assert.deepEqual(G.specProblems(game([q]), CTX), [], q.id);
    assert.deepEqual(G.specWaitsFor(game([q])), [], q.id);
    assert.equal(G.typeOf(game([q])), "questions", q.id);
  }
  // A wager still plays alone (C6, money, owns the stakes).
  const bet = { id: "bet", ask: "Is an idol played?", answer: "yesNo", points: 2, asked: "each", wager: 3, settle: { by: "moment", take: "happened", moment: "idolPlayed" } };
  assert.deepEqual(G.specProblems(game([{ ...bet, share: "split" }])).map((p) => p.problem), ["A wager plays alone: no share, rollover or shrink with it"]);
});

test("graded on facts: each call at its worth, then shared", () => {
  const facts = { from: 1, to: null, over: true, episodes: new Map(), winner: "f", ended: true, order: ["f", "e", "d", "c"], names: new Map(), groupNames: new Map(), phases: new Map() };
  const q = (x) => G.fullQuestion(x);
  const points = (qq, list) => Object.fromEntries(G.windowPoints(q(qq), G.verdictOf(q(qq), 0, facts), list.map(([playerId, answer, more]) => ({ playerId, answer, ...more })), facts));
  // Split: ann called it before the premiere (10), bo three episodes in (7), di twelve in (0), cy wrong. Two right with a call worth
  // something (di's shrank to nothing, so it takes no share): each one's worth over two.
  assert.deepEqual(points(POT, [["ann", "f", { late: 0 }], ["bo", "f", { late: 3 }], ["cy", "e", { late: 0 }], ["di", "f", { late: 12 }]]), { ann: 5, bo: 3.5, di: 0 });
  // Three right, each worth something: each one's worth over three, to the cent.
  assert.deepEqual(points(POT, [["ann", "f", { late: 0 }], ["bo", "f", { late: 3 }], ["di", "f", { late: 9 }]]), { ann: 3.33, bo: 2.33, di: 0.33 });
  // Nobody right worth anything: nothing each.
  assert.deepEqual(points(POT, [["ann", "f", { late: 10 }], ["bo", "f", { late: 11 }]]), { ann: 0, bo: 0 });
  // One right alone keeps what the call is worth (the shrink alone's); two at the same worth split it as a pot (the split alone's).
  assert.deepEqual(points(POT, [["ann", "f", { late: 4 }], ["bo", "e"]]), { ann: 6 });
  assert.deepEqual(points(POT, [["ann", "f", { late: 2 }], ["bo", "f", { late: 2 }]]), { ann: 4, bo: 4 });
  assert.deepEqual(points(POT, [["ann", "f", { late: 2 }], ["bo", "f", { late: 2 }]]), points({ ...POT, points: 8, shrink: undefined }, [["ann", "f"], ["bo", "f"]]), "the same worth: a pot of 8 split");
  // Per change: ann changed it twice once it started (8), bo never (10).
  assert.deepEqual(points(SEAL, [["ann", "f", { late: 5, changes: 2 }], ["bo", "f"]]), { ann: 4, bo: 5 });
  // Only the only one right, at their call's worth.
  assert.deepEqual(points(ALONE, [["ann", "f", { late: 3 }], ["bo", "e"]]), { ann: 7 });
  assert.deepEqual(points(ALONE, [["ann", "f", { late: 3 }], ["bo", "f"]]), {}, "two right: neither");
  // ...on a pick of three, each right pick nobody else named, at its namer's worth: f only ann's (two episodes late: 8), e both theirs
  // (nobody's), d only bo's (on time: 10).
  assert.deepEqual(points(TOP, [["ann", ["f", "e", "a"], { late: 2 }], ["bo", ["e", "d", "b"], { late: 0 }]]), { ann: 8, bo: 10 });
});

test("the sequence's shares take each answer's worth: a number is everyone's", () => {
  const units = new Map([["ann", 1], ["bo", 2], ["cy", 0]]);
  const worth = new Map([["ann", 9], ["bo", 6]]);
  // ann 9 x 1 / 3, bo 6 x 2 / 3.
  assert.deepEqual(Object.fromEntries(Seq.split((pid) => worth.get(pid), units)), { ann: 3, bo: 4 });
  assert.deepEqual(Seq.split(12, units), Seq.split(() => 12, units));
  // A share for each right one worth something: bo's call worth nothing, ann's 9 over her one.
  assert.deepEqual(Object.fromEntries(Seq.split((pid) => (pid === "ann" ? 9 : 0), units)), { ann: 9, bo: 0 });
  assert.deepEqual(Object.fromEntries(Seq.split(0, units)), { ann: 0, bo: 0 }, "a window worth nothing: nothing each, as before");
  assert.deepEqual(Object.fromEntries(Seq.only((pid) => worth.get(pid), new Map([["bo", 2]]))), { bo: 12 });
  assert.deepEqual(Object.fromEntries(Seq.onlyEach((pid) => worth.get(pid), new Map([["f", ["ann"]], ["e", ["ann", "bo"]], ["d", ["bo"]]]))), { ann: 9, bo: 6 });
  // On 2,000 made-up windows, a number's shares are the same whichever way it's given.
  let seed = 7;
  const rnd = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  for (let i = 0; i < 2000; i++) {
    const u = new Map(["a", "b", "c", "d"].map((p) => [p, rnd(4)]));
    const w = rnd(1000) / 7;
    assert.deepEqual(Seq.split(w, u), Seq.split(() => w, u));
    assert.deepEqual(Seq.only(w, u), Seq.only(() => w, u));
  }
});

test("through the engine: a league's winner call, its answers' lateness, its words", () => {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < 6; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, game([POT, ALONE]), { ctx: CTX }), []);
  const c = (i) => s.castaways[i].id;
  const answers = [
    { playerId: "ann", question: "pot", episode: 0, answer: c(0), late: 1 },
    { playerId: "bo", question: "pot", episode: 0, answer: c(0), late: 4 },
    { playerId: "cy", question: "pot", episode: 0, answer: c(1), late: 0 },
    { playerId: "ann", question: "alone", episode: 0, answer: c(1), late: 0 },
    { playerId: "bo", question: "alone", episode: 0, answer: c(0), late: 2 },
  ];
  const g = S.AnswerLogic.grade(s, answers, { from: 1, to: null, over: true, episodes: new Map(), winner: c(0), ended: true, order: [c(0), c(1)], names: new Map() });
  // The pot: ann 9 / 2, bo 6 / 2. Alone: bo the only one right, two late (8).
  assert.deepEqual(Object.fromEntries(g.earned.get("pot|0")), { ann: 4.5, bo: 3 });
  assert.deepEqual(Object.fromEntries(g.earned.get("alone|0")), { bo: 8 });
  assert.deepEqual(Object.fromEntries(g.points), { ann: 4.5, bo: 11 });
  const rules = G.describeSpec(game([POT, SEAL]), { show: "Survivor 51" }).rules.join(" ");
  assert.match(rules, /It's worth 1 point less for each episode that's started when you make or change it, and it's shared: what your call is worth is split between everyone who gets it right\./);
  assert.match(rules, /Once it's started, each change costs 1 point, and it's shared/);
});
