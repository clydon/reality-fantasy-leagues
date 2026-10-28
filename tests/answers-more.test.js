// More answers (docs/PLAN-start-a-game-gpt.md step A8): an order (the boot order, a leaderboard by a moment's count or by each
// person's points by the game's rules), confidence (a ranking with weights), chips spread over people, a wager on an answer,
// pairs (who outlasts whom, drawn the same every time) and a vote split (the jury's). Their shape and the data rule; the grader
// on facts; the engine's facts (each person's points, the jury's votes) and a game of them graded. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const ats = (problems) => problems.map((p) => p.at);
const game = (ask, extra) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask, ...extra });

/** Survivor's rules as the data rule sees them: research's moments and their points, a jury finale. */
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "votedOut", label: "Voted out", defaultPoints: -2, auto: true },
  ],
  results: true,
  winner: true,
  calls: "results",
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "tribes" }, { id: "merged" }],
};
const BOOT = { id: "boot", ask: "The first five out, in order", answer: "order", points: 2, pick: 5, within: 1, settle: { by: "results", take: "order" } };
const BOARD = { id: "board", ask: "This episode's leaderboard", answer: "order", points: 1, pick: 3, asked: "each", settle: { by: "points", take: "order" } };
const SURE = { id: "sure", ask: "Rank who goes home, surest first", answer: "confidence", points: 1, pick: 4, asked: "each", settle: { by: "results", take: "out" } };
const CHIPS = { id: "chips", ask: "Spread 10 chips on who wins immunity", answer: "chips", points: 1, chips: 10, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const SPLIT = { id: "split", ask: "The final jury vote", answer: "split", points: 5, settle: { by: "results", take: "split" } };
const PAIRS = { id: "pairs", ask: "Who outlasts whom?", answer: "pairs", points: 1, pairs: 3, settle: { by: "results", take: "outlast" } };
const BET = { id: "bet", ask: "An idol found tonight?", answer: "yesNo", points: 1, asked: "each", wager: 5, settle: { by: "moment", moment: "idolFound", take: "happened" } };
const TOP = { id: "top", ask: "Who scores the most points tonight?", answer: "person", points: 2, asked: "each", settle: { by: "points", take: "most" } };

test("an order, confidence, chips, a split, pairs and a wager: their shape and the data rule", () => {
  const at = (q, ctx, extra) => ats(G.specProblems(game([q], extra), ctx));
  for (const q of [BOOT, BOARD, SURE, CHIPS, SPLIT, PAIRS, BET, TOP]) assert.deepEqual(at(q, CTX), [], q.id);
  assert.deepEqual(at({ ...BOOT, pick: 1 }, CTX), ["ask[0].pick"], "an order ranks two or more");
  assert.deepEqual(at({ ...BOOT, pick: 25 }, CTX), ["ask[0].pick"]);
  assert.deepEqual(at({ ...BOOT, within: 6 }, CTX), ["ask[0].within"]);
  assert.deepEqual(at({ ...SURE, within: 1 }, CTX), ["ask[0].within"], "only an order scores within a few places");
  assert.deepEqual(at({ ...BOOT, settle: { by: "results", take: "out" } }, CTX), ["ask[0].settle"]);
  assert.deepEqual(at({ ...BOOT, asked: "each" }, CTX), ["ask[0].asked"], "the boot order of one episode is one boot");
  assert.deepEqual(at({ ...CHIPS, chips: 1 }, CTX), ["ask[0].chips"]);
  assert.deepEqual(at({ ...CHIPS, chips: undefined }, CTX), ["ask[0].chips"]);
  assert.deepEqual(at({ ...SPLIT, asked: "each" }, CTX), ["ask[0].asked"], "the jury's split is the season's");
  assert.deepEqual(at(SPLIT, CTX, { span: { from: 1, to: 6 } }), ["ask[0].settle"], "so the game runs to its end");
  assert.deepEqual(at(SPLIT, { ...CTX, jury: false }), ["ask[0].settle"], "no jury, no split");
  assert.deepEqual(at({ ...PAIRS, pairs: 13 }, CTX), ["ask[0].pairs"]);
  assert.deepEqual(at({ ...PAIRS, asked: "each" }, CTX), ["ask[0].asked"]);
  assert.deepEqual(at({ ...BET, wager: 0 }, CTX), ["ask[0].wager"]);
  assert.deepEqual(at({ ...BOOT, wager: 2 }, CTX), ["ask[0].wager"], "a wager goes on one answer");
  assert.deepEqual(at({ ...TOP, pick: 2, wager: 2 }, CTX), ["ask[0].wager"], "one person, not two");
  assert.deepEqual(at({ ...TOP, wager: 3 }, CTX), []);
  // A points leaderboard counts every moment the rules score: one the couch answers can't be in it.
  const couch = { ...CTX, moments: [...CTX.moments, { id: "cried", label: "Cried", defaultPoints: 1, answeredBy: "league" }] };
  assert.deepEqual(at(TOP, couch), ["ask[0].settle"]);
  assert.deepEqual(at({ ...TOP, settle: { by: "points", take: "most" } }, { ...CTX, moments: [] }), ["ask[0].settle"], "rules that score nothing");
  // All of them a game of questions plays.
  assert.equal(G.typeOf(game([BOOT, BOARD, SURE, CHIPS, SPLIT, PAIRS, BET, TOP])), "questions");
});

test("grading an order, confidence, chips, a split, pairs and a wager", () => {
  const facts = (o) => ({ from: 1, to: null, over: false, episodes: new Map(), winner: null, ended: false, order: null, names: new Map(), groupNames: new Map(), phases: new Map(), ...o });
  const who = (m) => new Map(Object.entries(m).map(([k, v]) => [k, new Map(Object.entries(v))]));
  const IN = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const e = (n, out, moments = {}, points = {}) => [n, { out, events: new Map(Object.keys(moments).map((k) => [k, 1])), who: who(moments), in: IN.filter((x) => !"abcdefgh".slice(0, n - 1).includes(x)), groups: new Map(), roles: new Map(), points: new Map(Object.entries(points)) }];
  const q = (x) => G.fullQuestion(x);
  const grade = (qq, n, answers, ff) => Object.fromEntries(G.pointsFor(q(qq), G.verdictOf(q(qq), n, ff), answers, ff));
  const A = (list) => list.map(([playerId, answer]) => ({ playerId, answer }));
  // a, b, c, d, e go home in episodes 1-5; the game's over at 5.
  const eps = new Map([e(1, ["a"], { individualImmunity: { c: 1 } }, { c: 3, a: -2 }), e(2, ["b"], { idolFound: { d: 1 } }, { d: 2, b: -2 }), e(3, ["c"]), e(4, ["d"]), e(5, ["e"])]);
  const over = facts({ episodes: eps, to: 5, over: true });
  // The boot order: each in its place, or within one.
  const v = G.verdictOf(q(BOOT), 0, over);
  assert.deepEqual(v.right, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(grade(BOOT, 0, A([["ann", ["a", "c", "b", "e", "d"]], ["bo", ["e", "d", "c", "b", "a"]]]), over), { ann: 10, bo: 2 }, "ann all within one; bo only c, in place");
  assert.deepEqual(G.verdictOf(q(BOOT), 0, facts({ episodes: eps })), { state: "waiting" }, "not until the game's over");
  // A leaderboard by points (ties share places), who scored most, by a moment's count.
  const board = G.verdictOf(q(BOARD), 1, over);
  assert.deepEqual([board.right[0], board.places.c, board.places.a], ["c", [0, 0], [7, 7]]);
  assert.deepEqual(grade(BOARD, 1, A([["ann", ["c", "b", "d"]], ["bo", ["a", "c", "b"]]]), over), { ann: 3, bo: 1 }, "six tie on 0, sharing places 1 to 6: bo's b in third counts");
  assert.deepEqual(G.verdictOf(q(TOP), 1, over), { state: "known", right: ["c"], value: 3 });
  assert.deepEqual(G.verdictOf(q(TOP), 3, over), { state: "off", why: "Nobody scored" });
  const byCount = G.verdictOf(q({ ...BOARD, settle: { by: "moment", moment: "idolFound", take: "order" } }), 2, over);
  assert.deepEqual(byCount.places.d, [0, 0]);
  // Confidence: each right one scores its weight (pick 4: 4 for the first).
  assert.deepEqual(grade(SURE, 2, A([["ann", ["b", "c", "d", "e"]], ["bo", ["c", "d", "e", "b"]]]), over), { ann: 4, bo: 1 });
  // Chips: each chip on someone right.
  assert.deepEqual(grade(CHIPS, 1, A([["ann", { c: 7, d: 3 }], ["bo", { a: 10 }]]), over), { ann: 7 });
  // The split: the jury's votes, most first, exactly.
  const ended = facts({ episodes: eps, to: 5, over: true, ended: true, jury: new Map([["f", 5], ["g", 2], ["h", 1]]) });
  assert.deepEqual(G.verdictOf(q(SPLIT), 0, ended), { state: "known", right: ["5-2-1"] });
  assert.deepEqual(grade(SPLIT, 0, A([["ann", [1, 5, 2]], ["bo", [4, 3, 1]]]), ended), { ann: 5 });
  assert.deepEqual(G.verdictOf(q(SPLIT), 0, { ...ended, jury: new Map() }), { state: "off", why: "No jury vote was recorded" });
  // A finalist with none: "5-3" either way.
  const zero = { ...ended, jury: new Map([["f", 5], ["g", 3], ["h", 0]]) };
  assert.deepEqual(grade(SPLIT, 0, A([["ann", [5, 3]], ["bo", [5, 3, 0]]]), zero), { ann: 5, bo: 5 });
  // Right is right at 0 points too.
  assert.equal(G.isRight(q({ ...SPLIT, points: 0 }), G.verdictOf(q(SPLIT), 0, ended), { playerId: "ann", answer: [5, 2, 1] }, [], ended), true);
  // Pairs: drawn the same every time from who was in at the start; each decided once one of them goes.
  const pairs = G.pairsFrom(q(PAIRS), IN);
  assert.deepEqual(pairs, G.pairsFrom(q(PAIRS), [...IN].reverse()), "the same draw, whatever the order");
  assert.equal(pairs.length, 3);
  assert.ok(pairs.flat().every((id) => IN.includes(id)) && new Set(pairs.flat()).size === 6);
  const early = facts({ episodes: new Map([e(1, ["a"]), e(2, ["b"])]), startIn: IN });
  const pv = G.verdictOf(q(PAIRS), 0, early);
  const decided = pairs.map((pair) => [G.pairKey(pair), pv.each?.[G.pairKey(pair)]?.state === "known" ? pv.each[G.pairKey(pair)].right[0] : null]);
  decided.forEach(([, won], i) => {
    const [x, y] = pairs[i];
    if (["a", "b"].includes(x) && ["a", "b"].includes(y)) assert.equal(won, x === "a" ? y : x, "both gone: the later outlasts");
    else if (["a", "b"].includes(x)) assert.equal(won, y);
    else if (["a", "b"].includes(y)) assert.equal(won, x);
    else assert.equal(won, null, "neither gone: still to settle");
  });
  const answer = Object.fromEntries(pairs.map(([x, y]) => [G.pairKey([x, y]), ["a", "b"].includes(x) ? y : x]));
  const right = decided.filter(([, won]) => won).length;
  assert.deepEqual(grade(PAIRS, 0, A([["ann", answer]]), early), right ? { ann: right } : {});
  // Two the same night tie; a game with an end of its own never reads the season's later finish order.
  const two = { ...PAIRS, pairs: 1 };
  const [[p, r]] = G.pairsFrom(q(two), ["p", "r"]);
  const night = facts({ episodes: new Map([[1, { out: [p, r], events: null, in: [p, r] }]]), startIn: [p, r] });
  assert.deepEqual(G.verdictOf(q(two), 0, night).each[G.pairKey([p, r])], { state: "off", why: "They went home the same night" });
  const short = facts({ episodes: new Map([[1, { out: [], events: null, in: [p, r] }]]), startIn: [p, r], to: 1, over: true, order: [p, r] });
  assert.deepEqual(G.verdictOf(q(two), 0, short).each[G.pairKey([p, r])], { state: "off", why: "Both made it to the end" });
  assert.deepEqual(G.verdictOf(q(two), 0, { ...short, to: null }).each[G.pairKey([p, r])], { state: "known", right: [p] }, "to the season's end: where they finished");
  // A double boot shares its places in the boot order.
  const double = facts({ episodes: new Map([e(1, ["a", "b"]), e(2, ["c"])]), to: 2, over: true });
  assert.deepEqual(G.verdictOf(q(BOOT), 0, double).places, { a: [0, 1], b: [0, 1], c: [2, 2] });
  // A wager: right, its points and the stake; wrong, the stake lost; off, nothing.
  assert.deepEqual(grade(BET, 2, A([["ann", { answer: "yes", stake: 4 }], ["bo", { answer: "no", stake: 3 }], ["cy", { answer: "no", stake: 9 }]]), over), { ann: 5, bo: -3, cy: -5 }, "a stake past the wager counts as the wager");
  assert.deepEqual(grade({ ...TOP, wager: 2 }, 3, A([["ann", { answer: "c", stake: 2 }]]), over), {}, "nobody scored: off, nothing lost");
  // What an answer has to be.
  const faces = new Set(IN);
  assert.equal(G.answerProblem(q(BOOT), ["a", "b"], faces), null, "fewer than its pick is fine");
  assert.equal(G.answerProblem(q(BOOT), ["a", "a"], faces), "Rank each one once");
  assert.equal(G.answerProblem(q(BOOT), ["a", "z"], faces), "Rank only who is still in");
  assert.equal(G.answerProblem(q(CHIPS), { a: 6, b: 5 }, faces), "Spread 1 to 10 chips");
  assert.equal(G.answerProblem(q(CHIPS), { a: 2.5 }, faces), "Chips are whole numbers, 0 or more");
  assert.equal(G.answerProblem(q(SPLIT), [5, 2, 1], null), null);
  assert.equal(G.answerProblem(q(SPLIT), [5, -1], null), "A split is a few whole numbers: [5, 2, 1]");
  const pairFaces = new Set(pairs.flatMap((pair) => pair.map((id) => `${G.pairKey(pair)}:${id}`)));
  assert.equal(G.answerProblem(q(PAIRS), { [G.pairKey(pairs[0])]: pairs[0][0] }, pairFaces), null);
  assert.equal(G.answerProblem(q(PAIRS), { [G.pairKey(pairs[0])]: pairs[1][0] }, pairFaces), "Name one of the pair");
  assert.equal(G.answerProblem(q(BET), { answer: "yes", stake: 6 }), "Stake 0 to 5 points");
  assert.equal(G.answerProblem(q(BET), "yes"), "Your answer and your stake: { answer, stake }");
  assert.equal(G.answerProblem(q(BET), { answer: "maybe", stake: 1 }), "Yes or no");
});

test("the engine's facts for them: each person's points by the game's rules, the jury's votes; a game of them graded", () => {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < 6; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, game([BOARD, TOP, CHIPS], { span: { from: 1, to: 2 } }), { ctx: CTX }), []);
  const c = (i) => s.castaways[i].id;
  const e1 = S.ensureEpisodeNumber(s, 1, false);
  S.addScoringEvent(s, e1.id, "individualImmunity", c(0));
  S.addScoringEvent(s, e1.id, "idolFound", c(1));
  S.addElimination(s, e1.id, c(5), "Voted Out");
  const f = S.AnswerLogic.facts(s);
  const worth = Object.fromEntries(S.formatOf(s).events.map((x) => [x.id, typeof x.defaultPoints === "number" ? x.defaultPoints : x.defaultPoints.exclusive]));
  assert.deepEqual(f.episodes.get(1).points, new Map([[c(0), worth.individualImmunity], [c(1), worth.idolFound], [c(5), worth.votedOut]]), "the rulebook's points, the implied exit's too");
  const answers = [
    { playerId: "ann", question: "top", episode: 1, answer: worth.individualImmunity >= worth.idolFound ? c(0) : c(1) },
    { playerId: "bo", question: "chips", episode: 1, answer: { [c(0)]: 6, [c(2)]: 4 } },
  ];
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(s, answers).points), { ann: 2, bo: 6 });
  // The jury's votes once the season's over (the finalists' exits).
  assert.equal(f.jury, null);
  // How it works says each.
  const words = G.describeSpec(game([BOOT, SURE, CHIPS, SPLIT, PAIRS, BET])).rules;
  assert.deepEqual(words.slice(1, 7), [
    "Before it starts: The first five out, in order Put five in order: 2 points for each in its place, or within one place of it.",
    "Before each episode: Rank who goes home, surest first Rank four, the one you're surest of first: each one right scores 1 point times its rank from the bottom (4 for the first).",
    "Before each episode: Spread 10 chips on who wins immunity Spread ten chips: 1 point for each chip on someone right.",
    "Before it starts: The final jury vote 5 points for the split exactly.",
    "Before it starts: Who outlasts whom? Three pairs, the same for everyone: 1 point for each one you call.",
    "Before each episode: An idol found tonight? 1 point if you're right. Stake up to 5 points on it: right, you win them too; wrong, you lose them.",
  ]);
});
