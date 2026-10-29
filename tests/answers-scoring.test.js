// Scoring that combines (docs/PLAN-start-a-game-gpt.md step A9, part 1: per question, and points per bingo line): a pot split
// between everyone right (rarer right calls win more), only the only right answer, a jackpot that rolls over, a parlay that
// multiplies, a call whose points shrink with time (each episode that's started when it's made, or each change once the game's
// on), a wager of any of your points (double or nothing, on A8's wager), and points per bingo line. Their shape and the data
// rule; the grader on facts; the engine's grading of a game of them (rollover window by window, a parlay's windows, when an
// answer was made); the settings both ways; How it works. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const ats = (problems) => problems.map((p) => p.at);
const game = (ask, extra) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask, ...extra });
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
const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const IMM = { id: "imm", ask: "Who wins immunity?", answer: "person", points: 2, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const POT = { ...OUT, id: "pot", ask: "10 points split between everyone who calls the boot", points: 10, share: "split" };
const ONLY = { ...OUT, id: "only", ask: "Only if you're the only one", share: "only" };
const ROLL = { ...OUT, id: "roll", ask: "Who goes home? Nobody right, it rolls over", rollover: true };
const WIN = { id: "win", ask: "Who wins?", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "winner" } };
const SEAL = { ...WIN, id: "seal", ask: "Seal your winner: every change costs a point", shrink: { points: 1, per: "change" } };
const ALL_IN = { id: "allin", ask: "Who goes home? Bet any of your points", answer: "person", points: 1, asked: "each", wager: "total", settle: { by: "results", take: "out" } };
const PARLAY = { of: ["out", "imm"], times: 3 };

test("A9's ways of combining: their shape, and where each goes", () => {
  const at = (ask, ctx, extra) => ats(G.specProblems(game(ask, extra), ctx));
  for (const q of [POT, ONLY, ROLL, WIN, SEAL, ALL_IN]) assert.deepEqual(at([q], CTX), [], q.id);
  assert.deepEqual(at([OUT, IMM], CTX, { score: { by: "answers", parlays: [PARLAY] } }), []);
  // A share is split or only, never on the show's calls.
  assert.deepEqual(at([{ ...OUT, share: "half" }], CTX), ["ask[0].share"]);
  // Rolling over needs a next window.
  assert.deepEqual(at([{ ...OUT, asked: "once", rollover: true }], CTX), ["ask[0].rollover"]);
  assert.deepEqual(at([{ ...OUT, rollover: false }], CTX), ["ask[0].rollover"]);
  assert.deepEqual(at([{ ...ROLL, asked: "every", every: 2, share: "split" }], CTX), [], "a pot that rolls over, every two episodes");
  // Shrinking: only a call that stays open once the game is on (asked once, closing at the finale).
  assert.deepEqual(at([{ ...OUT, shrink: { points: 1, per: "episode" } }], CTX), ["ask[0].shrink"]);
  assert.deepEqual(at([{ ...WIN, shrink: { points: 0, per: "episode" } }], CTX), ["ask[0].shrink"]);
  assert.deepEqual(at([{ ...WIN, shrink: { points: 1, per: "day" } }], CTX), ["ask[0].shrink"]);
  assert.deepEqual(at([{ ...WIN, shrink: { points: 1, per: "episode", by: 2 } }], CTX), ["ask[0].shrink.by"]);
  assert.deepEqual(at([{ ...WIN, share: "only" }], CTX), ["ask[0].shrink"], "a shrinking call is its own");
  // A wager plays alone; 'total' is any of your points.
  assert.deepEqual(at([{ ...ALL_IN, wager: "all" }], CTX), ["ask[0].wager"]);
  assert.deepEqual(at([{ ...ALL_IN, share: "split" }], CTX), ["ask[0].wager"]);
  assert.deepEqual(at([{ ...ALL_IN, rollover: true }], CTX), ["ask[0].wager"]);
  // Parlays: 2 to 4 plain questions, asked the same way, each in one; more than 1 times, up to 10.
  const parlay = (parlays, ask = [OUT, IMM]) => at(ask, CTX, { score: { by: "answers", parlays } });
  assert.deepEqual(parlay([{ of: ["out"], times: 3 }]), ["score.parlays[0].of"]);
  assert.deepEqual(parlay([{ of: ["out", "nope"], times: 3 }]), ["score.parlays[0].of"]);
  assert.deepEqual(parlay([{ of: ["out", "imm"], times: 1 }]), ["score.parlays[0].times"]);
  assert.deepEqual(parlay([{ of: ["out", "imm"], times: 11 }]), ["score.parlays[0].times"]);
  assert.deepEqual(parlay([PARLAY, PARLAY]), ["score.parlays[1].of", "score.parlays[1].of"], "a question in two parlays");
  assert.deepEqual(parlay([PARLAY], [OUT, { ...IMM, asked: "once" }]), ["score.parlays[0].of"], "asked the same way");
  assert.deepEqual(parlay([PARLAY], [{ ...OUT, share: "split" }, IMM]), ["score.parlays[0].of"], "plain legs");
  assert.deepEqual(parlay([PARLAY], [{ ...OUT, pick: 2 }, IMM]), ["score.parlays[0].of"], "one answer each");
  assert.deepEqual(parlay([{ ...PARLAY, also: 1 }]), ["score.parlays[0].also"]);
  assert.deepEqual(parlay([]), ["score.parlays"]);
  assert.deepEqual(ats(G.specProblems({ preset: "outlast", score: { by: "place", parlays: [PARLAY] } })), ["score.parlays"], "only a game of questions");
  // Points per bingo line.
  assert.deepEqual(ats(G.specProblems({ preset: "weekly-bingo", score: { by: "lines", points: 5 } }, CTX)), []);
  assert.deepEqual(ats(G.specProblems({ preset: "weekly-bingo", score: { by: "lines", points: 0 } })), ["score.points"]);
  assert.deepEqual(ats(G.specProblems({ preset: "weekly-bingo", score: { by: "lines", points: 2.5 } })), ["score.points"]);
  // All of them play now.
  assert.equal(G.typeOf(game([POT, ONLY, ROLL, WIN, SEAL, ALL_IN, OUT, IMM], { score: { by: "answers", parlays: [PARLAY] } })), "questions");
  assert.equal(G.typeOf({ preset: "weekly-bingo", score: { by: "lines", points: 5 } }), "weekly-bingo");
  assert.deepEqual(G.specWaitsFor(game([POT, ROLL, WIN])), []);
});

test("grading A9's ways on facts: a split pot, only the only one, a shrinking call, any of your points", () => {
  const facts = (o) => ({ from: 1, to: null, over: false, episodes: new Map(), winner: null, ended: false, order: null, names: new Map(), groupNames: new Map(), phases: new Map(), ...o });
  const IN = ["a", "b", "c", "d", "e", "f"];
  const e = (n, out) => [n, { out, events: new Map(), who: new Map(), in: IN, groups: new Map(), roles: new Map(), points: new Map() }];
  const f = facts({ episodes: new Map([e(1, ["a"]), e(2, ["b", "c"])]) });
  const q = (x) => G.fullQuestion(x);
  const A = (list) => list.map(([playerId, answer, more]) => ({ playerId, answer, ...more }));
  const points = (qq, n, answers, ff = f, o) => Object.fromEntries(G.windowPoints(q(qq), G.verdictOf(q(qq), n, ff), answers, ff, o));
  // With none of A9's ways, exactly A4's points.
  for (const [qq, n, list] of [[OUT, 1, A([["ann", "a"], ["bo", "b"]])], [{ ...OUT, pick: 2 }, 2, A([["ann", ["b", "c"]], ["bo", ["c", "d"]]])]]) {
    assert.deepEqual(G.windowPoints(q(qq), G.verdictOf(q(qq), n, f), list, f), G.pointsFor(q(qq), G.verdictOf(q(qq), n, f), list, f));
  }
  // A pot: 10 split between everyone right; the rarer, the more.
  assert.deepEqual(points(POT, 1, A([["ann", "a"], ["bo", "a"], ["cy", "b"]])), { ann: 5, bo: 5 });
  assert.deepEqual(points(POT, 1, A([["ann", "a"], ["bo", "c"]])), { ann: 10 }, "one right takes the pot");
  assert.deepEqual(points(POT, 1, A([["ann", "a"], ["bo", "a"], ["cy", "a"]])), { ann: 3.33, bo: 3.33, cy: 3.33 }, "to the cent");
  assert.deepEqual(points(POT, 1, A([["ann", "b"]])), {}, "nobody right, nobody scores");
  // ...by what each would have earned: two right picks take twice one's share.
  assert.deepEqual(points({ ...POT, pick: 2 }, 2, A([["ann", ["b", "c"]], ["bo", ["c", "d"]]])), { ann: 6.67, bo: 3.33 });
  // ...and a rollover's jackpot is the pot.
  assert.deepEqual(points(POT, 1, A([["ann", "a"], ["bo", "a"]]), f, { worth: 30 }), { ann: 15, bo: 15 });
  // Only the only one right.
  assert.deepEqual(points(ONLY, 1, A([["ann", "a"], ["bo", "b"]])), { ann: 2 });
  assert.deepEqual(points(ONLY, 1, A([["ann", "a"], ["bo", "a"]])), {}, "two right: neither");
  const closest = { id: "n", ask: "How many go home?", answer: "number", points: 3, asked: "each", share: "only", settle: { by: "moment", moment: "idolFound", take: "count" } };
  const counted = facts({ episodes: new Map([[1, { out: [], events: new Map([["idolFound", 2]]), who: new Map(), in: IN, groups: new Map(), roles: new Map(), points: new Map() }]]) });
  assert.deepEqual(points(closest, 1, A([["ann", 1], ["bo", 3]]), counted), {}, "the closest tie: neither is the only one");
  assert.deepEqual(points(closest, 1, A([["ann", 2], ["bo", 3]]), counted), { ann: 3 });
  // A shrinking call: 1 less for each episode started when it was made; or each change once the game's on; never below 0.
  const won = facts({ episodes: new Map([e(1, ["a"])]), winner: "f", ended: true, over: true, order: ["f", "e"] });
  assert.deepEqual(points(WIN, 0, A([["ann", "f", { late: 0 }], ["bo", "f", { late: 3 }], ["cy", "e", { late: 0 }], ["di", "f", { late: 12 }]]), won), { ann: 10, bo: 7 });
  assert.deepEqual(points(SEAL, 0, A([["ann", "f", { late: 5, changes: 2 }], ["bo", "f"]]), won), { ann: 8, bo: 10 }, "per change: its changes, not when");
  assert.equal(G.shrunk(q(WIN), 10, { late: 4 }), 6);
  assert.equal(G.shrunk(q(SEAL), 10, null), 10);
  // Any of your points: the stake as it was checked when it was given (no cap of its own), double or nothing.
  assert.deepEqual(points(ALL_IN, 1, A([["ann", { answer: "a", stake: 20 }], ["bo", { answer: "b", stake: 7 }]])), { ann: 21, bo: -7 });
  assert.equal(G.answerProblem(q(ALL_IN), { answer: "a", stake: 8 }, null, { most: 7 }), "Stake 0 to 7 points");
  assert.equal(G.answerProblem(q(ALL_IN), { answer: "a", stake: 7 }, null, { most: 7.5 }), null);
  assert.equal(G.answerProblem(q(ALL_IN), { answer: "a", stake: 1 }, null, { most: -3 }), "You have no points to stake yet: stake 0");
  assert.equal(G.answerProblem(q(ALL_IN), { answer: "a", stake: 0 }, null, { most: 0 }), null);
  assert.equal(G.answerProblem(q(ALL_IN), { answer: "a", stake: -1 }), "A stake is a whole number of points, 0 or more");
  // A parlay's legs: who's right on every one.
  const legs = (o, i) => [
    { q: q(OUT), v: G.verdictOf(q(OUT), 1, f), answers: A(o) },
    { q: q(OUT), v: G.verdictOf(q(OUT), 2, f), answers: A(i) },
  ];
  assert.deepEqual([...G.allRight(legs([["ann", "a"], ["bo", "a"], ["cy", "b"]], [["ann", "b"], ["bo", "d"], ["cy", "c"]]), f)], ["ann"]);
  assert.deepEqual([...G.allRight([{ q: q(OUT), v: { state: "waiting" }, answers: A([["ann", "a"]]) }], f)], [], "a leg still to settle");
});

/** A Survivor league of six castaways and three players, made a game of `ask` through setGame (the show's ctx). */
function league(ask, extra) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < 6; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, game(ask, extra), { ctx: CTX }), []);
  return s;
}

test("the engine grades them: a rollover window by window, a parlay's windows, when an answer was made", () => {
  // Rollover: Episode 1 nobody right (2 carried), Episode 2 nobody answered (4 carried), Episode 3 ann and bo right (6 each).
  const s = league([ROLL, OUT, IMM, POT], { score: { by: "answers", parlays: [PARLAY] } });
  const c = (i) => s.castaways[i].id;
  for (const [n, gone] of [[1, 5], [2, 4], [3, 3]]) {
    const ep = S.ensureEpisodeNumber(s, n, false);
    S.addElimination(s, ep.id, c(gone), "Voted Out");
    if (n === 1) S.addScoringEvent(s, ep.id, "individualImmunity", c(0));
  }
  S.ensureEpisodeNumber(s, 4, false);
  const A = (question, episode, list) => list.map(([playerId, answer]) => ({ playerId, question, episode, answer }));
  const answers = [
    ...A("roll", 1, [["ann", c(4)]]),
    ...A("roll", 3, [["ann", c(3)], ["bo", c(3)], ["cy", c(2)]]),
    ...A("roll", 4, [["ann", c(2)]]),
    // The parlay: ann right on both in 1 (triple), bo only on who went home.
    ...A("out", 1, [["ann", c(5)], ["bo", c(5)]]),
    ...A("imm", 1, [["ann", c(0)], ["bo", c(1)]]),
    // The pot: ann and cy share it in 2.
    ...A("pot", 2, [["ann", c(4)], ["cy", c(4)], ["bo", c(3)]]),
  ];
  const g = S.AnswerLogic.grade(s, answers);
  assert.deepEqual([1, 2, 3, 4].map((n) => g.worth.get(`roll|${n}`)), [2, 4, 6, 2], "the jackpot grows until it's won; the next is open, back to 2");
  assert.deepEqual(Object.fromEntries(g.earned.get("roll|3")), { ann: 6, bo: 6 });
  assert.equal(g.earned.has("roll|2"), false, "nobody answered 2: it rolled, nothing to earn");
  assert.deepEqual(Object.fromEntries(g.earned.get("out|1")), { ann: 6, bo: 2 }, "ann's right on both: triple");
  assert.deepEqual(Object.fromEntries(g.earned.get("imm|1")), { ann: 6 });
  assert.deepEqual(Object.fromEntries(g.earned.get("pot|2")), { ann: 5, cy: 5 });
  assert.deepEqual(Object.fromEntries(g.points), { ann: 23, bo: 8, cy: 5 });
  // As someone who's seen only Episode 1: the rollover stops at 2 (waiting), nothing after it counts yet.
  const one = S.SpoilerLogic.viewThrough(s, 1);
  const g1 = S.AnswerLogic.grade(one, answers);
  assert.deepEqual([g1.worth.get("roll|2"), g1.worth.has("roll|3"), g1.earned.has("roll|3")], [4, false, false]);
  assert.deepEqual(Object.fromEntries(g1.points), { ann: 12, bo: 2 });
  // A wager and a plain question are graded as A8 and A4 had them.
  const plain = league([OUT]);
  const pe = S.ensureEpisodeNumber(plain, 1, false);
  S.addElimination(plain, pe.id, plain.castaways[0].id, "Voted Out");
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(plain, [{ playerId: "ann", question: "out", episode: 1, answer: plain.castaways[0].id }]).points), { ann: 2 });
});

test("when an answer is made: how many of the game's episodes had started, by their locks and air times", () => {
  const s = league([WIN, SEAL]);
  const now = Date.parse("2026-10-20T12:00:00Z");
  const e1 = S.ensureEpisodeNumber(s, 1, false);
  e1.airsAt = "2026-10-01T00:00:00Z";
  assert.equal(S.AnswerLogic.started(s, { now }), 1, "1 aired");
  // 2 isn't made yet: the schedule's air time.
  const airAtOf = (n) => ({ 2: "2026-10-08T00:00:00Z", 3: "2026-10-30T00:00:00Z" })[n] ?? null;
  assert.equal(S.AnswerLogic.started(s, { now, airAtOf }), 2);
  // Locked early by whoever runs it.
  S.ensureEpisodeNumber(s, 3, false).lineupsLocked = true;
  assert.equal(S.AnswerLogic.started(s, { now, airAtOf }), 3);
  assert.equal(S.AnswerLogic.started(s, { now: Date.parse("2026-09-01T00:00:00Z"), airAtOf }), 0, "before the premiere");
  // A finale call graded with its answers' late and changes.
  const g = S.AnswerLogic.grade({ ...s, castaways: s.castaways }, [
    { playerId: "ann", question: "win", episode: 0, answer: s.castaways[0].id, late: 2, changes: 0 },
    { playerId: "bo", question: "seal", episode: 0, answer: s.castaways[0].id, late: 2, changes: 1 },
  ], { from: 1, to: null, over: true, episodes: new Map(), winner: s.castaways[0].id, ended: true, order: [s.castaways[0].id], names: new Map() });
  assert.deepEqual(Object.fromEntries(g.points), { ann: 8, bo: 9 });
});

test("the settings both ways, and How it works", () => {
  // A game of questions' parlays and a bingo's line points are fields too, so a league plays them with the flag off.
  const spec = G.fullSpec(game([OUT, IMM, POT], { score: { by: "answers", parlays: [PARLAY] } }));
  const fields = G.settingsOf(spec);
  assert.deepEqual(fields.parlays, [PARLAY]);
  assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, spec)), spec);
  const bingo = G.fullSpec({ preset: "weekly-bingo", score: { by: "lines", points: 5 } });
  assert.equal(G.settingsOf(bingo).linePoints, 5);
  assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, bingo)), bingo);
  assert.equal(G.settingsOf(G.fullSpec({ preset: "weekly-bingo" })).linePoints, undefined, "none: the field goes, a line a point");
  assert.deepEqual(G.fullSpec({ preset: "weekly-bingo" }).score, { by: "lines" }, "nothing new in a stored spec");
  // How it works.
  const rules = G.describeSpec(game([POT, ONLY, ROLL, WIN, SEAL, ALL_IN, OUT, IMM], { score: { by: "answers", parlays: [PARLAY] } })).rules;
  assert.deepEqual(rules.slice(1, 9), [
    "Before each episode: 10 points split between everyone who calls the boot 10 points if you're right. The points are a pot, split between everyone who gets it right: the fewer of you, the more each gets.",
    "Before each episode: Only if you're the only one 2 points if you're right. It only scores if you're the only one who gets it right.",
    "Before each episode: Who goes home? Nobody right, it rolls over 2 points if you're right. If nobody gets it, its points roll over to the next one.",
    "Before the finale: Who wins? 10 points if you're right. It's worth 1 point less for each episode that's started when you make or change it: the earlier you call it, the more it's worth.",
    "Before the finale: Seal your winner: every change costs a point 10 points if you're right. Once it's started, each change costs 1 point.",
    "Before each episode: Who goes home? Bet any of your points 1 point if you're right. Stake any of your points on it: right, you win them too; wrong, you lose them.",
    "Before each episode: Who goes home? 2 points if you're right.",
    "Before each episode: Who wins immunity? 2 points if you're right.",
  ]);
  assert.ok(rules.includes('A parlay: right on "Who goes home?" and "Who wins immunity?" together, and your points on them are triple.'), rules.join("\n"));
  // A spec still being made says what it can: a parlay with no questions yet is left out, not a crash.
  assert.doesNotThrow(() => G.describeSpec(game([OUT], { score: { by: "answers", parlays: [{ times: 2 }, null] } })));
  const lines = G.describeSpec({ preset: "weekly-bingo", score: { by: "lines", points: 5 } });
  assert.ok(lines.sentence.endsWith("5 points a line; most points by the finale wins."), lines.sentence);
  assert.ok(lines.rules.includes("Each line is worth 5 points. Most points by the finale wins."));
});
