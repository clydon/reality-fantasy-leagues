// Money (docs/PLAN-start-a-game-gpt.md track C, C6): a bank everyone starts with (score.bank: its stakes drawn from it, and with
// `out` whoever runs out is out), a stake's odds (ask[].odds: even money, A8's, or the pool, the couch's own: the wrong stakes split
// between the right ones by their stakes), and a stake as a line of its own beside the question's points, so a wager goes with a share,
// a rollover or a shrink, and a parlay multiplies a staked leg. Their shape, words and settings; the sequence's stake lines; grading
// on a made-up season whose every number is worked out by hand below; the walk of a bank that runs out. Tracker row p24. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Seq = require("../src/lib/game/sequence/index.js");

const A = S.AnswerLogic;
const CTX = {
  moments: [{ id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" }],
  results: true, winner: true, roles: [], grouped: true, jury: true, phases: [],
};
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 10, asked: "each", settle: { by: "results", take: "out" } };
const IDOL = { id: "idol", ask: "An idol found?", answer: "yesNo", points: 2, asked: "each", settle: { by: "moment", moment: "idolFound", take: "happened" } };
const game = (ask, score = {}, rank = { by: "total" }) => ({ spec: 1, get: { by: "none" }, count: null, score: { by: "answers", ...score }, rank, ask });
const problems = (s) => G.specProblems(s, CTX).map((p) => `${p.at}: ${p.problem}`);
const ats = (s) => G.specProblems(s, CTX).map((p) => p.at);
const WORDS = { show: "Survivor 51", castaway: "castaway", moments: CTX.moments };

/** A game of questions on Survivor with ten castaways and `players`, made `spec` through setGame. */
function league(spec, players = ["ann", "bo", "cy", "di"]) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "questions");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
/** Episode n's results: who went home (castaway indexes) and who found an idol; none of either, a quiet night. */
function results(s, n, outs, idols = []) {
  const e = S.ensureEpisodeNumber(s, n, false);
  for (const i of outs) S.addElimination(s, e.id, cid(s, i), "Voted Out");
  for (const i of idols) S.addScoringEvent(s, e.id, "idolFound", cid(s, i));
  if (!outs.length && !idols.length) S.EpisodeLogic.setNoExit(s, e.id, true);
}
/** Stakes on one question at an episode: { player: [answer (a castaway index, or as it is), stake] }. */
const bets = (s, question, n, by) =>
  Object.entries(by).map(([playerId, [a, stake]]) => ({ playerId, question, episode: n, answer: { answer: Number.isInteger(a) ? cid(s, a) : a, stake } }));
const obj = (m) => Object.fromEntries(m || []);

test("its shape: a bank, a stake's odds, a stake beside a share, a rollover, a shrink or a parlay; what's refused", () => {
  // p24: a stake beside a split pot.
  assert.deepEqual(problems(game([{ ...BOOT, wager: 5, share: "split" }])), []);
  assert.deepEqual(problems(game([{ ...IDOL, wager: 3, rollover: true, share: "only" }])), []);
  const WIN = { id: "win", ask: "Who wins?", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "winner" } };
  assert.deepEqual(problems(game([{ ...WIN, wager: "total" }])), []);
  // A parlay's staked leg.
  assert.deepEqual(problems(game([{ ...BOOT, wager: 5 }, IDOL], { parlays: [{ of: ["boot", "idol"], times: 2 }] })), []);
  // The odds: even or the pool, only on a stake.
  assert.deepEqual(problems(game([{ ...BOOT, wager: "total", odds: "pool" }])), []);
  assert.deepEqual(problems(game([{ ...BOOT, odds: "pool" }])), ["ask[0].odds: Only a stake has odds: give it a wager"]);
  assert.deepEqual(problems(game([{ ...BOOT, wager: 5, odds: "long" }])), ["ask[0].odds: A right stake pays even money, or a share of the pool: even or pool"]);
  // A bank: 1 to 10,000 to start, out or not, on a game with a stake, ranked by its points (or last one standing when it's out).
  const bank = (b, rank, ask = [{ ...BOOT, wager: "total" }]) => game(ask, { bank: b }, rank);
  assert.deepEqual(problems(bank({ start: 500 })), []);
  assert.deepEqual(problems(bank({ start: 500, out: true }, { by: "standing" })), []);
  assert.deepEqual(problems(bank({ start: 500, out: true })), [], "out, ranked by the total: whoever's out is on nothing");
  assert.deepEqual(problems(bank({ start: 500, out: false })), []);
  assert.deepEqual(problems(bank({ start: 0 })), ["score.bank.start: A bank starts with 1 to 10,000"]);
  assert.deepEqual(problems(bank({ start: 10001 })), ["score.bank.start: A bank starts with 1 to 10,000"]);
  assert.deepEqual(problems(bank({ start: 500, out: "yes" })), ["score.bank.out: A bank at zero is out (true), or plays on (false)"]);
  assert.deepEqual(problems(bank(500)), ["score.bank: A bank is { start: 1 to 10,000, out?: true }"]);
  assert.deepEqual(problems(bank({ start: 500 }, { by: "total" }, [BOOT])), ["score.bank: A bank is for stakes: stake on at least one question (a wager)"]);
  assert.deepEqual(problems(bank({ start: 500 }, { by: "matchups" })), ["score.bank: Head to head and weeks won read what each episode adds, and a bank's start is there before any: rank by the total"]);
  assert.deepEqual(problems(bank({ start: 500 }, { by: "total", race: { to: 500 } })), ["score.bank: A race with a bank runs past its start: to more than 500"]);
  assert.deepEqual(problems(bank({ start: 500 }, { by: "total", race: { to: 501 } })), []);
  assert.ok(ats(bank({ start: 500, more: 1 })).includes("score.bank.more"), "only start and out");
  // Last one standing needs something that knocks players out: a bank that's out does, one that plays on doesn't.
  assert.ok(ats(bank({ start: 500 }, { by: "standing" })).includes("rank.by"));
  // A bank is a game of questions': a draft's points are its team's.
  assert.ok(ats({ ...G.PRESETS.outlast, score: { ...G.PRESETS.outlast.score, bank: { start: 500 } } }).includes("score.bank"));
  // A stake against the bot's call is still refused (it's on your own call).
  assert.ok(ats(game([{ ...BOOT, wager: 5, beat: { by: "bot" } }])).includes("ask[0].beat"));
  for (const s of [bank({ start: 500, out: true }, { by: "standing" }), game([{ ...BOOT, wager: 5, share: "split" }])]) {
    assert.equal(G.typeOf(s), "questions");
    assert.deepEqual(G.specWaitsFor(s), []);
  }
  // Read the one way.
  assert.deepEqual(G.bankOf(bank({ start: 500 })), { start: 500, out: false });
  assert.deepEqual(G.bankOf(bank({ start: 500, out: true }, { by: "standing" })), { start: 500, out: true });
  assert.equal(G.bankOf(game([BOOT])), null);
  assert.equal(G.answerParts(bank({ start: 500 })), null, "a bank that plays on knocks nobody out: nothing to walk");
  assert.equal(G.answerParts(bank({ start: 500, out: true }, { by: "standing" })).broke, true);
  assert.equal("broke" in G.answerParts(game([BOOT], { lives: 2 }, { by: "standing" })), false, "every game before C6 reads its parts as it did");
  assert.equal(G.drawsOnBank({ ...BOOT, wager: 5 }, null), false);
  assert.equal(G.drawsOnBank({ ...BOOT, wager: 5 }, { start: 500 }), true);
  assert.equal(G.drawsOnBank({ ...BOOT, wager: "total" }, null), true);
  assert.equal(G.drawsOnBank(BOOT, { start: 500 }), false);
});

test("its settings, both ways: a bank in questionsBank, odds with the questions", () => {
  const spec = G.fullSpec(game([{ ...BOOT, wager: "total", odds: "pool" }, { ...IDOL, wager: 5 }], { bank: { start: 500, out: true } }, { by: "standing" }));
  const st = G.settingsOf(spec);
  assert.deepEqual(st.questionsBank, { start: 500, out: true });
  assert.equal(st.questions[0].odds, "pool");
  const back = G.specOf(st);
  assert.deepEqual(back.score, { by: "answers", bank: { start: 500, out: true } });
  // Last one standing is said where only the bank knocks players out (lives or cuts imply it).
  assert.equal(st.questionsRank, "standing");
  assert.equal(back.rank.by, "standing");
  assert.equal(G.specOf(G.settingsOf(G.fullSpec(game([{ ...BOOT, wager: "total" }], { bank: { start: 500, out: true } })))).rank.by, "total");
  assert.deepEqual(back.ask, spec.ask);
  assert.equal(G.settingsOf(G.fullSpec(game([{ ...BOOT, wager: 5 }]))).questionsBank, undefined);
});

test("its words: the stake beside a share, the pool's odds, the bank", () => {
  const d = (s) => G.describeSpec(G.fullSpec(s), WORDS);
  // p24.
  const p24 = d(game([{ ...BOOT, wager: 5, share: "split" }]));
  assert.match(p24.sentence, /10 points each time, split between everyone right\. Stake up to 5 points on it: double or nothing\.$/);
  assert.ok(p24.rules.some((r) => r.endsWith("The points are a pot, split between everyone who gets it right: the fewer of you, the more each gets. Your stake stays yours: it isn't shared, carried over or shrunk.")), p24.rules.join("\n"));
  // A bank that's out, every stake the pool's.
  const pool = d(game([{ ...BOOT, wager: "total", odds: "pool" }, { ...IDOL, wager: "total", odds: "pool" }], { bank: { start: 500, out: true } }, { by: "standing" }));
  assert.match(pool.sentence, /Stake any of your bank on each: right, a share of the wrong stakes; wrong, you lose it\. Everyone starts with a bank of 500 points\. Run out and you're out\. Last one standing wins\.$/);
  assert.ok(pool.rules.includes("Before each episode: Who goes home? 10 points if you're right. Stake any of your bank on it: right, you take a share of the wrong stakes, by how much you staked; wrong, you lose it. If nobody's right, every stake comes back."), pool.rules.join("\n"));
  assert.ok(pool.rules.includes("Everyone starts with a bank of 500 points, and every stake comes out of it: you can't stake more than you have left, less what's still riding on answers to be settled. Run out and you're out."));
  assert.ok(pool.rules.some((r) => r.startsWith("Last one standing wins:")));
  // Out, ranked by the total: once one is left it's over.
  const outTotal = d(game([{ ...BOOT, wager: "total" }], { bank: { start: 500, out: true } }));
  assert.ok(outTotal.rules.includes("Once you're out you answer nothing more: your bank stays empty. Once one of you is left, or none, it's over."), outTotal.rules.join("\n"));
  assert.ok(outTotal.rules.includes("Most points wins."));
  // A bank that plays on, ranked by the total; a fixed stake of it.
  const on = d(game([{ ...BOOT, wager: 50 }], { bank: { start: 500 } }));
  assert.match(on.sentence, /Stake up to 50 points of your bank on it: double or nothing\. Everyone starts with a bank of 500 points\.$/);
  assert.ok(on.rules.includes("Everyone starts with a bank of 500 points, and every stake comes out of it: you can't stake more than you have left, less what's still riding on answers to be settled. Run out and you can still answer, with nothing to stake."));
  assert.ok(on.rules.includes("Most points wins."));
  // A parlay's staked leg.
  const parlay = d(game([{ ...BOOT, wager: 5 }, IDOL], { parlays: [{ of: ["boot", "idol"], times: 2 }] }));
  assert.ok(parlay.rules.includes('A parlay: right on "Who goes home?" and "An idol found?" together, and your points on them are double. A stake you win on them is too.'), parlay.rules.join("\n"));
  // A wager alone reads as it always did.
  const alone = d(game([{ ...BOOT, wager: 5 }]));
  assert.match(alone.sentence, /10 points for each right answer\. Stake up to 5 points on it: double or nothing\.$/);
  assert.ok(alone.rules.includes("Before each episode: Who goes home? 10 points if you're right. Stake up to 5 points on it: right, you win them too; wrong, you lose them."));
});

test("the sequence's stakes: even money, and the pool", () => {
  const list = [{ playerId: "a", stake: 5, right: true }, { playerId: "b", stake: 3, right: false }, { playerId: "c", stake: 2, right: true }];
  assert.deepEqual(obj(Seq.stakes(list, "even")), { a: 5, b: -3, c: 2 });
  // The pool: the wrong stakes (3) split between the right ones by their stakes (5 and 2 of 7): 15/7 = 2.14, 6/7 = 0.86.
  assert.deepEqual(obj(Seq.stakes(list, "pool")), { a: 2.14, b: -3, c: 0.86 });
  // Nobody right: every stake comes back; everyone right: nothing to win.
  assert.deepEqual(obj(Seq.stakes([{ playerId: "a", stake: 5, right: false }], "pool")), {});
  assert.deepEqual(obj(Seq.stakes([{ playerId: "a", stake: 5, right: true }, { playerId: "b", stake: 1, right: true }], "pool")), {});
  assert.deepEqual(obj(Seq.stakes([{ playerId: "a", stake: 5, right: false }], "even")), { a: -5 });
  // The pool's shares add up to the pot exactly: 20 three ways is 6.67, 6.67 and 6.66 (the cents left over to the first); 10 three
  // ways 3.34, 3.33, 3.33.
  const three = (pot) => [...["a", "b", "c"].map((playerId) => ({ playerId, stake: 1, right: true })), { playerId: "d", stake: pot, right: false }];
  assert.deepEqual(obj(Seq.stakes(three(20), "pool")), { a: 6.67, b: 6.67, c: 6.66, d: -20 });
  assert.deepEqual(obj(Seq.stakes(three(10), "pool")), { a: 3.34, b: 3.33, c: 3.33, d: -10 });
  // By the largest remainder: stakes of 1 and 2 on a pot of 1: 0.333 and 0.667, so 0.33 and 0.67.
  assert.deepEqual(obj(Seq.stakes([{ playerId: "a", stake: 1, right: true }, { playerId: "b", stake: 2, right: true }, { playerId: "c", stake: 1, right: false }], "pool")), { a: 0.33, b: 0.67, c: -1 });
  assert.deepEqual(obj(Seq.plus(new Map([["a", 10], ["b", 3.33]]), new Map([["a", -3], ["c", 2], ["b", 0.005]]))), { a: 7, b: 3.34, c: 2 });
});

test("graded: a stake beside a split pot (p24), the pool from a bank, a rollover carried on its points alone, a staked parlay", () => {
  // p24: ten castaways; Episode 1, Castaway 9 goes home.
  let s = league(game([{ ...BOOT, wager: 5, share: "split" }]));
  results(s, 1, [9]);
  results(s, 2, []);
  // ann, bo and di right (the 10-point pot three ways: 3.33 each), ann staking 5, bo 2, di nothing; cy wrong, staking 4.
  // Episode 2 a quiet night: nobody went home, so it doesn't count either way, every stake back.
  let g = A.grade(s, [...bets(s, "boot", 1, { ann: [9, 5], bo: [9, 2], cy: [8, 4], di: [9, 0] }), ...bets(s, "boot", 2, { ann: [1, 5], cy: [2, 4] })]);
  assert.deepEqual(obj(g.earned.get("boot|1")), { ann: 8.33, bo: 5.33, di: 3.33, cy: -4 });
  assert.deepEqual(obj(g.earned.get("boot|2")), {});
  assert.deepEqual(obj(g.points), { ann: 8.33, bo: 5.33, di: 3.33, cy: -4 });

  // A bank of 100, any of it staked, at the pool's odds. ann and di right (10 points each); the wrong stakes, bo's 20 and cy's 40, are
  // a pot of 60 split by the right ones' stakes (ann's 30 and di's 10 of 40): ann 45, di 15.
  s = league(game([{ ...BOOT, wager: "total", odds: "pool" }], { bank: { start: 100 } }));
  results(s, 1, [9]);
  g = A.grade(s, bets(s, "boot", 1, { ann: [9, 30], bo: [8, 20], cy: [7, 40], di: [9, 10] }));
  assert.deepEqual(obj(g.earned.get("boot|1")), { ann: 55, di: 25, bo: -20, cy: -40 });
  assert.deepEqual(obj(g.points), { ann: 155, bo: 80, cy: 60, di: 125 });
  // Every seat starts with the bank, answers or not.
  assert.deepEqual(obj(A.grade(s, []).points), { ann: 100, bo: 100, cy: 100, di: 100 });

  // An idol found? 2 points, only the only one right, rolling over, a stake of up to 3 beside it. Episode 1, Castaway 0 finds one: ann
  // and bo both right (nobody's points: they roll over) and win their stakes (3 and 1), cy wrong (loses 2). Episode 2, none found: ann
  // the only one right on "no", the window worth 4 (its 2 and the 2 carried), and her stake of 2: 6. The stakes won in Episode 1
  // don't stop the carry: it's on the points alone.
  s = league(game([{ ...IDOL, share: "only", rollover: true, wager: 3 }]));
  results(s, 1, [9], [0]);
  results(s, 2, [8]);
  g = A.grade(s, [...bets(s, "idol", 1, { ann: ["yes", 3], bo: ["yes", 1], cy: ["no", 2] }), ...bets(s, "idol", 2, { ann: ["no", 2], bo: ["yes", 0] })]);
  assert.deepEqual([g.worth.get("idol|1"), g.worth.get("idol|2")], [2, 4]);
  assert.deepEqual(obj(g.earned.get("idol|1")), { ann: 3, bo: 1, cy: -2 });
  assert.deepEqual(obj(g.earned.get("idol|2")), { ann: 6 });

  // A parlay of who goes home (a stake of up to 5) and an idol found, doubled. ann right on both: (10 + 5) x 2 and 2 x 2. bo right on
  // who goes home only: 15. cy wrong on who goes home (loses 5), right on the idol: 2.
  s = league(game([{ ...BOOT, wager: 5 }, IDOL], { parlays: [{ of: ["boot", "idol"], times: 2 }] }));
  results(s, 1, [9], [0]);
  g = A.grade(s, [
    ...bets(s, "boot", 1, { ann: [9, 5], bo: [9, 5], cy: [8, 5] }),
    ...["ann", "bo", "cy"].map((p, i) => ({ playerId: p, question: "idol", episode: 1, answer: ["yes", "no", "yes"][i] })),
  ]);
  assert.deepEqual(obj(g.earned.get("boot|1")), { ann: 30, bo: 15, cy: -5 });
  assert.deepEqual(obj(g.earned.get("idol|1")), { ann: 4, cy: 2 });
});

test("a stake is held to what's left of a bank, as answered", () => {
  const q = G.fullQuestion({ ...BOOT, wager: 5 });
  assert.equal(G.answerProblem(q, { answer: "x", stake: 5 }, null), null, "with no bank, up to the wager");
  assert.equal(G.answerProblem(q, { answer: "x", stake: 5 }, null, { most: 3.5 }), "Stake 0 to 3 points");
  assert.equal(G.answerProblem(q, { answer: "x", stake: 3 }, null, { most: 3.5 }), null);
  assert.equal(G.answerProblem(q, { answer: "x", stake: 4 }, null, { most: 40 }), null);
  assert.equal(G.answerProblem(q, { answer: "x", stake: 6 }, null, { most: 40 }), "Stake 0 to 5 points");
  assert.equal(G.answerProblem(q, { answer: "x", stake: 1 }, null, { most: 0 }), "You have no points to stake yet: stake 0");
});

test("a bank that runs out: out at nothing, their answers after it counting for nobody, the last one standing", () => {
  const spec = game([{ ...BOOT, wager: "total" }], { bank: { start: 10, out: true } }, { by: "standing" });
  const s = league(spec, ["ann", "bo", "cy"]);
  results(s, 1, [9]);
  results(s, 2, [8]);
  // Episode 1: ann stakes all 10 on Castaway 8, wrong: 0, out. bo stakes 4 on Castaway 9, right: 10 + 10 + 4 = 24. cy stakes nothing,
  // wrong: 10. Episode 2: ann's answer counts for nobody; bo stakes all 24 on Castaway 8, right: 24 + 10 + 24 = 58; cy stakes all 10
  // on Castaway 1, wrong: 0, out. One left: it's over at Episode 2.
  const rows = [...bets(s, "boot", 1, { ann: [8, 10], bo: [9, 4], cy: [7, 0] }), ...bets(s, "boot", 2, { ann: [8, 0], bo: [8, 24], cy: [1, 10] })];
  const w = A.walk(s, rows, A.facts(s));
  assert.deepEqual(w.out, { ann: 1, cy: 2 });
  assert.equal(w.ends, 2);
  assert.deepEqual(w.totals, { ann: 0, bo: 58, cy: 0 });
  const v = A.withWalk(s, w);
  // Episode 2's early results: cy's stake lost there doesn't empty her bank until they're final (the walk waits on the newest).
  S.EpisodeLogic.setResultsStage(s, s.episodes.find((e) => e.number === 2).id, "early");
  assert.deepEqual(A.walk(s, rows, A.facts(s)).out, { ann: 1 });
  S.EpisodeLogic.setResultsStage(s, s.episodes.find((e) => e.number === 2).id, "final");
  assert.deepEqual(S.computeScores(v).map((r) => [r.playerId, r.total, r.out]), [["bo", 58, null], ["cy", 0, 2], ["ann", 0, 1]]);
  // A bank that plays on: nothing to walk, ann on nothing still in.
  const on = league(game([{ ...BOOT, wager: "total" }], { bank: { start: 10 } }), ["ann", "bo", "cy"]);
  results(on, 1, [9]);
  const first = bets(on, "boot", 1, { ann: [8, 10], bo: [9, 4], cy: [7, 0] });
  assert.equal(A.walk(on, first, A.facts(on)), null);
  assert.deepEqual(obj(A.grade(on, first).points), { ann: 0, bo: 24, cy: 10 });
});

// ---------- C6 part 2: a ticket a player builds ----------
const IMM = { id: "imm", ask: "Who wins immunity?", answer: "person", points: 1, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const LEG_BOOT = { ...BOOT, points: 1 };
const LEG_IDOL = { ...IDOL, points: 1 };
const TICKET = { id: "ticket", ask: "Build a ticket", answer: "ticket", points: 0, asked: "each", wager: "total", settle: { by: "legs", of: ["boot", "imm", "idol"] } };
const T_CTX = { ...CTX, moments: [...CTX.moments, { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }] };
const sheet = (ticket = TICKET, score = { bank: { start: 100 } }) => game([LEG_BOOT, IMM, LEG_IDOL, ticket], score);
const tProblems = (s) => G.specProblems(s, T_CTX).map((p) => `${p.at}: ${p.problem}`);

test("a ticket: its shape, its defaults, what's refused, its words", () => {
  assert.deepEqual(tProblems(sheet()), []);
  assert.equal(G.typeOf(sheet()), "questions");
  assert.deepEqual(tProblems(sheet({ ...TICKET, wager: 20, legs: { min: 2, max: 2 }, pays: [4] })), []);
  assert.deepEqual(tProblems(sheet({ ...TICKET, legs: { min: 3 }, pays: [2, 5] })), []);
  assert.deepEqual(tProblems(sheet(TICKET, {})), [], "staking your points, no bank");
  // Read the one way: two legs at least, as many as it's built from, each leg doubling what rides on it (3 for two, 7 for three).
  const t = G.ticketOf(G.fullQuestion(TICKET));
  assert.deepEqual([t.of, t.min, t.max, t.pays(2), t.pays(3), t.pays(1)], [["boot", "imm", "idol"], 2, 3, 3, 7, 1]);
  assert.deepEqual([G.ticketOf({ ...TICKET, pays: [2, 5] }).pays(2), G.ticketOf({ ...TICKET, pays: [2, 5] }).pays(3)], [2, 5]);
  assert.equal(G.ticketOf(BOOT), null);
  // Refused, each with why.
  const bad = (t, at) => assert.ok(tProblems(sheet(t)).some((p) => p.startsWith(`ask[3].${at}`)), `${at}: ${tProblems(sheet(t)).join(" | ")}`);
  bad({ ...TICKET, settle: { by: "legs", of: ["boot"] } }, "settle.of");
  bad({ ...TICKET, settle: { by: "legs", of: ["boot", "nope"] } }, "settle.of");
  bad({ ...TICKET, settle: { by: "legs", of: ["boot", "boot"] } }, "settle.of");
  bad({ ...TICKET, settle: { by: "legs", of: ["boot", "ticket"] } }, "settle.of");
  bad({ ...TICKET, settle: { by: "results", take: "out" } }, "settle");
  bad({ ...TICKET, wager: undefined }, "wager");
  bad({ ...TICKET, odds: "pool" }, "odds");
  bad({ ...TICKET, points: 5 }, "points");
  bad({ ...TICKET, share: "split" }, "share");
  bad({ ...TICKET, legs: { min: 4 } }, "legs.min");
  bad({ ...TICKET, legs: { min: 3, max: 2 } }, "legs.max");
  bad({ ...TICKET, pays: [3] }, "pays");
  bad({ ...TICKET, pays: [5, 2] }, "pays");
  bad({ ...TICKET, legs: { minimum: 2 } }, "legs.minimum");
  // A leg asked another way, or one that isn't one right-or-wrong answer.
  assert.ok(tProblems(game([LEG_BOOT, { ...IMM, asked: "every", every: 2 }, TICKET], { bank: { start: 100 } })).some((p) => p.includes('"imm" is asked another way')));
  assert.ok(tProblems(game([LEG_BOOT, { ...IMM, pick: 2 }, LEG_IDOL, TICKET], {})).some((p) => p.includes(`"imm" isn't one answer that's right or wrong`)));
  // Only a ticket is settled by its legs; a ticket is a game of questions'; it's never a life's question.
  assert.ok(tProblems(game([LEG_BOOT, LEG_IDOL, { ...LEG_IDOL, id: "x", settle: { by: "legs", of: ["boot", "idol"] } }])).some((p) => p.endsWith("Only a ticket is settled by its legs")));
  assert.ok(tProblems(game([{ ...LEG_BOOT, asked: "once", closes: "start", settle: { by: "results", take: "out" } }, { ...LEG_IDOL, asked: "once" }, { ...TICKET, asked: "once", closes: "finale", settle: { by: "legs", of: ["boot", "idol"] } }], {})).some((p) => p.includes('"boot" is asked another way')), "a ticket closing after its legs");
  assert.ok(tProblems(game([{ ...LEG_IDOL, wager: 5, pays: [5] }])).includes("ask[0].pays: Only a ticket has legs and pays"));
  assert.equal(G.livesQuestion(TICKET), false);
  assert.equal(G.draftPlayable(TICKET), false);
  // Its words.
  const d = G.describeSpec(G.fullSpec(sheet()), { ...WORDS, moments: T_CTX.moments });
  assert.match(d.sentence, /everyone answers three questions before each episode: who goes home, who wins immunity and an idol found, all season\. A point for each right answer\. Build a ticket from who goes home, who wins immunity and an idol found: put two to three of your calls on it and stake any of your bank; all of them right wins 3 times your stake for two, 7 for three\. Everyone starts with a bank of 100 points\.$/);
  assert.ok(d.rules.includes(`Before each episode: Build a ticket: from "Who goes home?", "Who wins immunity?" and "An idol found?", put two to three of your answers on it and stake any of your bank on all of them being right. All right, you win 3 times your stake for two, 7 for three; one wrong, or left blank, you lose your stake. A leg that doesn't count drops out and the ticket rides on the rest (none left: your stake back).`), d.rules.join("\n"));
  // Answered as { legs, stake }.
  const q = G.fullQuestion(TICKET);
  assert.equal(G.answerProblem(q, { legs: ["boot", "idol"], stake: 10 }, null, { most: 100 }), null);
  assert.equal(G.answerProblem(q, { legs: ["boot"], stake: 10 }, null, { most: 100 }), "Put 2 to 3 on it");
  assert.equal(G.answerProblem(q, { legs: ["boot", "boot"], stake: 10 }, null, { most: 100 }), "Put each question on it once");
  assert.equal(G.answerProblem(q, { legs: ["boot", "nope"], stake: 10 }, null, { most: 100 }), "Put only this ticket's questions on it");
  assert.equal(G.answerProblem(q, { legs: ["boot", "idol"], stake: 101 }, null, { most: 100 }), "Stake 0 to 100 points");
  assert.equal(G.answerProblem(q, "boot", null, { most: 100 }), "Your ticket and your stake: { legs: [questions], stake }");
});

test("a ticket graded: every leg right pays by the legs, one wrong or blank loses, a leg that doesn't count drops out", () => {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "questions");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy", "di"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, sheet(), { ctx: T_CTX }), []);
  const e1 = S.ensureEpisodeNumber(s, 1, false);
  S.addElimination(s, e1.id, cid(s, 9), "Voted Out");
  S.addScoringEvent(s, e1.id, "individualImmunity", cid(s, 0));
  S.addScoringEvent(s, e1.id, "idolFound", cid(s, 1));
  results(s, 2, []);
  S.ensureEpisodeNumber(s, 3, false);
  const say = (n, by) => Object.entries(by).flatMap(([playerId, a]) => Object.entries(a).map(([question, answer]) => ({ playerId, question, episode: n, answer: question === "ticket" ? answer : typeof answer === "number" ? cid(s, answer) : answer })));
  const rows = [
    // Episode 1 (Castaway 9 out, Castaway 0 immune, an idol found): ann right on all three, a ticket of all three for 10: 7 x 10 = 70.
    // bo wrong on immunity, his ticket of the boot and immunity for 20 lost. cy right on the boot and the idol, a ticket of the two for
    // 5: 3 x 5 = 15. di right on the boot, immunity left blank, a ticket of the two for 10 lost.
    ...say(1, {
      ann: { boot: 9, imm: 0, idol: "yes", ticket: { legs: ["boot", "imm", "idol"], stake: 10 } },
      bo: { boot: 9, imm: 2, ticket: { legs: ["boot", "imm"], stake: 20 } },
      cy: { boot: 9, idol: "yes", ticket: { legs: ["boot", "idol"], stake: 5 } },
      di: { boot: 9, ticket: { legs: ["boot", "imm"], stake: 10 } },
    }),
    // Episode 2, a quiet night (nobody home: the boot doesn't count; no idol found): ann's ticket of the boot and the idol rides on the
    // idol alone, right: once her stake, 10. bo's the same way, wrong on the idol: 5 lost.
    ...say(2, {
      ann: { boot: 1, idol: "no", ticket: { legs: ["boot", "idol"], stake: 10 } },
      bo: { boot: 2, idol: "yes", ticket: { legs: ["boot", "idol"], stake: 5 } },
    }),
    // Episode 3, no results yet: nothing either way.
    ...say(3, { ann: { boot: 1, idol: "no", ticket: { legs: ["boot", "idol"], stake: 10 } } }),
  ];
  const g = A.grade(s, rows);
  assert.deepEqual(obj(g.earned.get("ticket|1")), { ann: 70, bo: -20, cy: 15, di: -10 });
  assert.deepEqual(g.verdicts.get("ticket|1").tickets, { ann: { right: true, legs: 3 }, bo: { right: false, legs: 1 }, cy: { right: true, legs: 2 }, di: { right: false, legs: 1 } });
  assert.deepEqual(obj(g.earned.get("ticket|2")), { ann: 10, bo: -5 });
  assert.equal(g.verdicts.get("ticket|3").state, "waiting");
  assert.deepEqual(obj(g.earned.get("ticket|3")), {});
  // The bank, the legs' own points and the tickets: ann 100 + 3 + 70 + 1 (the idol, Episode 2) + 10 = 184; bo 100 + 1 - 20 - 5 = 76;
  // cy 100 + 2 + 15 = 117; di 100 + 1 - 10 = 91.
  assert.deepEqual(obj(g.points), { ann: 184, bo: 76, cy: 117, di: 91 });
  // Right as the reads have it: won, lost, or none of its legs counted.
  assert.equal(G.isRight(G.fullQuestion(TICKET), g.verdicts.get("ticket|1"), { playerId: "ann" }, []), true);
  assert.equal(G.isRight(G.fullQuestion(TICKET), g.verdicts.get("ticket|1"), { playerId: "bo" }, []), false);
  // Every leg that doesn't count: the stake back. A pays list of its own: 2 for two right.
  const q = G.fullQuestion({ ...TICKET, pays: [2, 5] });
  const off = { state: "off", why: "Nobody went home" };
  const v = G.ticketVerdict(q, [{ q: G.fullQuestion(LEG_BOOT), v: off, answers: [] }, { q: G.fullQuestion(LEG_IDOL), v: off, answers: [] }], [{ playerId: "ann", answer: { legs: ["boot", "idol"], stake: 10 } }]);
  assert.deepEqual(v.tickets, { ann: { right: null, legs: 0 } });
  assert.deepEqual(obj(G.windowPoints(q, v, [{ playerId: "ann", answer: { legs: ["boot", "idol"], stake: 10 } }])), {});
  // A push (an over/under right on its line) drops out, as a leg that's off.
  const OU = G.fullQuestion({ id: "ou", ask: "Idols found: over or under 1?", answer: "overUnder", line: 1, points: 1, asked: "each", settle: { by: "moment", moment: "idolFound", take: "count" } });
  const push = { state: "known", right: [], value: 1 };
  const idolRight = { state: "known", right: ["yes"] };
  const pv = G.ticketVerdict(G.fullQuestion({ ...TICKET, settle: { by: "legs", of: ["ou", "idol"] } }), [{ q: OU, v: push, answers: [{ playerId: "ann", answer: "over" }] }, { q: G.fullQuestion(LEG_IDOL), v: idolRight, answers: [{ playerId: "ann", answer: "yes" }] }], [{ playerId: "ann", answer: { legs: ["ou", "idol"], stake: 10 } }]);
  assert.deepEqual(pv.tickets, { ann: { right: true, legs: 1 } });
  const won = { state: "known", right: [], tickets: { ann: { right: true, legs: 2 } } };
  assert.deepEqual(obj(G.windowPoints(q, won, [{ playerId: "ann", answer: { legs: ["boot", "idol"], stake: 10 } }])), { ann: 20 });
});

test("the blind replays build a ticket from the answers a seat gives with it", () => {
  const B = require("../scripts/dev-test/blind.js");
  const q = { id: "ticket", answer: "ticket", wager: "total", stakeMost: 50, ticket: { of: ["boot", "imm", "idol"], min: 2, max: 3, pays: [3, 7] } };
  assert.deepEqual(B.ticketFor(q, { boot: "c1", idol: { answer: "yes", stake: 2 } }), { legs: ["boot", "idol"], stake: 2 });
  assert.equal(B.ticketFor(q, { boot: "c1" }), undefined, "fewer than it takes: none");
  assert.deepEqual(B.ticketFor({ ...q, stakeMost: 0 }, { boot: "c1", imm: "c2", idol: "no" }), { legs: ["boot", "imm", "idol"], stake: 0 });
  // Stakes drawn from one bank fit what's left of it together: 3 left, 2 on each of three, so 2, 1 and 0.
  const body = { boot: { answer: "c1", stake: 2 }, idol: { answer: "no", stake: 2 }, ticket: { legs: ["boot", "idol"], stake: 2 }, imm: "c2" };
  B.fitStakes([{ id: "boot", stakeMost: 3 }, { id: "idol", stakeMost: 3 }, { id: "ticket", stakeMost: 3 }, { id: "imm", stakeMost: null }], body);
  assert.deepEqual([body.boot.stake, body.idol.stake, body.ticket.stake, body.imm], [2, 1, 0, "c2"]);
});
