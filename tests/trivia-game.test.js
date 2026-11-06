// Trivia in a game (docs/PLAN-start-a-game-gpt.md step A13 part 1: the dial row settle.trivia, the request p1 "bingo cards and trivia
// every episode, bingo lines are worth 5 points, correct trivia questions earn one point"): a question in a game of questions answered
// from the episode's trivia key, the bot's trivia research as it's written and checked today (db/trivia-research.js, trivia_questions):
// the round before each episode, about the one before it (the batch written after it), answered { [question id]: option }, closing as
// the episode starts and graded once it has results, its points for each one right. Its shape and the data-can-settle rule (a season
// whose research writes none); its words; grading at a viewer's mark; each fallback from the start (no key: the premiere's round, a run
// that wrote nothing; a question pulled after it was asked; a batch written again after it was answered: void, no points either way;
// no key read at all: waiting); its answer's shape; A9's ways of combining (a split pot, a rollover); a life riding on it; and the
// p1 game in stages, a stage of bingo with a stage of trivia alongside. The server's reads (trivia-key.ts, answers.ts) are proven by
// scripts/dev-test/check-trivia-game.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { describeSpec } = require("../src/lib/game/game-spec/describe.js");

const A = S.AnswerLogic;
const ats = (problems) => problems.map((p) => p.at);

const CTX = { moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true };
/** The round of trivia before each episode, a point for each one right. */
const TRIVIA = { id: "trivia", ask: "Trivia about the episode before", answer: "trivia", points: 1, asked: "each", settle: { by: "trivia" } };
const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const game = (ask, score = {}, extra = {}) => ({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers", ...score }, rank: { by: "total" }, ask, ...extra });

/** A game of questions on Survivor with castaways C0.. and seats ann, bo and cy, its spec through setGame, Episodes 1 to `eps`. */
function league(spec, { n = 8, eps = 6 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "wikiSeason", 51);
  S.updateSettings(s, "leagueTypeId", G.madeAs(G.typeOf(spec)));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => s.episodes.find((e) => e.number === n);
/** Episode n's results: castaway `i` voted out. */
const boot = (s, n, i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out");
/** A key question: its id, the right option, of four. */
const item = (id, answer, episode = 1) => ({ id, answer, episode, kind: "text", question: `Question ${id}?`, options: ["a", "b", "c", "d"], why: null, source: null });
/** The trivia keys, by the episode each round is before: { 2: [item...] }. */
const keys = (o) => new Map(Object.entries(o).map(([n, list]) => [Number(n), list]));
/** Trivia answers at a window: { player: { id: option } }. */
const said = (n, by, question = "trivia") => Object.entries(by).map(([playerId, answer]) => ({ playerId, question, episode: n, answer }));
const factsOf = (s, trivia) => ({ ...A.facts(s), ...(trivia ? { trivia } : {}) });

test("a trivia question's shape: a round before each episode, settled by its key and nothing else; what's refused", () => {
  const at = (q, score, ctx = CTX) => ats(G.specProblems(game([q], score), ctx));
  assert.deepEqual(at(TRIVIA), []);
  assert.equal(G.typeOf(game([TRIVIA])), "questions", "a game of questions");
  assert.deepEqual(G.specWaitsFor(game([TRIVIA])), [], "nothing it needs is still to build");
  assert.deepEqual(at({ ...TRIVIA, asked: undefined }), ["ask[0].asked"], "asked once isn't a round before each episode");
  assert.deepEqual(at({ ...TRIVIA, asked: "every", every: 2 }), ["ask[0].asked"]);
  assert.deepEqual(at({ ...TRIVIA, over: 2 }), ["ask[0].asked"], "about the one episode before it, not a run");
  assert.deepEqual(at({ ...TRIVIA, settle: { by: "trivia", take: "who" } }), ["ask[0].settle.take"], "the key settles it: no take");
  assert.deepEqual(at({ ...TRIVIA, settle: { by: "results", take: "out" } }), ["ask[0].settle"], "trivia is settled by its key alone");
  assert.deepEqual(at({ ...OUT, settle: { by: "trivia" } }), ["ask[0].settle", "ask[0].answer"], "and the key settles trivia alone");
  assert.deepEqual(at({ id: "c", ask: "A choice", answer: "choice", options: ["a", "b"], points: 1, asked: "each", settle: { by: "trivia" } }), ["ask[0].answer"]);
  assert.deepEqual(at({ ...TRIVIA, wager: 2 }), ["ask[0].wager", "ask[0].wager"], "nothing to stake on one answer");
  assert.deepEqual(at({ ...TRIVIA, each: "person" }), ["ask[0].answer"], "not a question about each person");
  assert.deepEqual(at({ ...TRIVIA, pick: 2 }), ["ask[0].pick"]);
  assert.deepEqual(at({ ...TRIVIA, options: ["a", "b"] }), ["ask[0].options"]);
  assert.deepEqual(at({ ...TRIVIA, points: -1 }), ["ask[0].points"]);
  // A9's ways of combining go through its right answers; a parlay's legs are one answer that's right or wrong.
  assert.deepEqual(at({ ...TRIVIA, share: "split" }), []);
  assert.deepEqual(at({ ...TRIVIA, rollover: true }), []);
  assert.deepEqual(ats(G.specProblems(game([TRIVIA, OUT], { parlays: [{ of: ["trivia", "out"], times: 2 }] }), CTX)), ["score.parlays[0].of"]);
  // A life can ride on it: a round with none right (or none answered) costs one.
  assert.equal(G.livesQuestion(G.fullSpec(game([TRIVIA])).ask[0]), true);
  assert.deepEqual(ats(G.specProblems(game([TRIVIA], { lives: 2 }, { rank: { by: "standing" } }), CTX)), []);
  // The data rule: a season whose research writes no trivia (its trivia run off) has nothing to settle it; unsaid, it's written.
  assert.deepEqual(at(TRIVIA, {}, { ...CTX, trivia: false }), ["ask[0].settle"]);
  assert.deepEqual(at(TRIVIA, {}, { ...CTX, trivia: true }), []);
  // Beside a draft (C2 part 4c): one of its own questions, its round's points a line of the draft's; beside a pool, no place.
  assert.deepEqual(G.specWaitsFor({ ...G.PRESETS.outlast, ask: [TRIVIA] }), []);
  assert.equal(G.typeOf({ ...G.PRESETS.outlast, ask: [TRIVIA] }), "classic-draft");
  assert.deepEqual(G.specWaitsFor({ ...G.PRESETS["survival-pool"], ask: [TRIVIA] }).map((w) => `${w.at}: ${w.problem}`), ["ask: No game plays this way yet: a pool's picks are its game: questions beside them play in a stage alongside it"]);
});

test("a trivia question in words: the round before each episode, a point for each one right", () => {
  const d = describeSpec(game([TRIVIA]), CTX);
  const all = JSON.stringify(d);
  assert.match(all, /Before each episode: Trivia about the episode before\?? A few questions about the episode before it and the season so far, the same for everyone: 1 point for each one right\./);
});

test("graded from the key once its episode has results, at each viewer's mark: its points for each one right", () => {
  const s = league(game([TRIVIA]));
  const trivia = keys({ 2: [item("q1", "a"), item("q2", "b"), item("q3", "c")] });
  const rows = [...said(2, { ann: { q1: "a", q2: "b", q3: "d" }, bo: { q1: "d", q2: "d" } })];
  boot(s, 1, 0);
  // The round before Episode 2 locked as it started; until it has results, it waits (nothing changes once they're in).
  let g = A.grade(s, rows, factsOf(s, trivia));
  assert.equal(g.verdicts.get("trivia|2").state, "waiting");
  assert.equal(g.points.size, 0);
  boot(s, 2, 1);
  g = A.grade(s, rows, factsOf(s, trivia));
  const v = g.verdicts.get("trivia|2");
  assert.equal(v.state, "known");
  assert.deepEqual(Object.keys(v.each), ["q1", "q2", "q3"]);
  assert.equal(g.points.get("ann"), 2, "two right");
  assert.equal(g.points.has("bo"), false, "none right");
  assert.equal(G.isRight(TRIVIA, v, rows[0], rows, factsOf(s, trivia)), true);
  assert.equal(G.isRight(TRIVIA, v, rows[1], rows, factsOf(s, trivia)), false);
  // A viewer who hasn't seen Episode 2: their copy has no results for it, so the round waits for them (spoiler-safe).
  const behind = S.GhostLogic.viewFor(s, null, 1);
  assert.equal(A.grade(behind, rows, factsOf(behind, trivia)).verdicts.get("trivia|2").state, "waiting");
  // What was known through Episode 1 (a walk's step) keeps the key; the round is graded only once its own episode is in.
  const f1 = G.factsThrough(factsOf(s, trivia), 1);
  assert.equal(f1.trivia, trivia);
  assert.equal(G.verdictOf(TRIVIA, 2, f1).state, "waiting");
  // Three points a right one.
  const s3 = league(game([{ ...TRIVIA, points: 3 }]));
  boot(s3, 1, 0);
  boot(s3, 2, 1);
  assert.equal(A.grade(s3, rows, factsOf(s3, trivia)).points.get("ann"), 6);
});

test("its fallbacks, from the start: no key is void; a pulled question, or a key written again, counts for nobody; no key read waits", () => {
  const s = league(game([TRIVIA]));
  boot(s, 1, 0);
  boot(s, 2, 1);
  boot(s, 3, 2);
  const answers = said(2, { ann: { q1: "a" } }).concat(said(1, { ann: { q0: "a" } }), said(3, { ann: { q9: "a" }, bo: { q9: "b" } }));
  // The premiere's round (nothing written after an Episode 0) and a run that wrote nothing: off, no points either way.
  const g = A.grade(s, answers, factsOf(s, keys({ 3: [item("q9", "a", 2)] })));
  assert.equal(g.verdicts.get("trivia|1").state, "off");
  assert.match(g.verdicts.get("trivia|1").why, /no trivia/i);
  assert.equal(g.verdicts.get("trivia|2").state, "off");
  assert.equal(g.points.get("ann"), 1, "only Episode 3's round counted");
  // Every question of a round pulled (two flags, an admin's): the key has none, so the round is off.
  assert.equal(A.grade(s, answers, factsOf(s, keys({}))).verdicts.get("trivia|3").state, "off");
  // One question pulled after it was asked: it isn't in the key, so nobody scores on it; the rest still count.
  const two = said(2, { ann: { q1: "a", q2: "b" }, bo: { q2: "b" } });
  const pulled = factsOf(s, keys({ 2: [item("q1", "a")] }));
  const gp = A.grade(s, two, pulled);
  assert.equal(gp.points.get("ann"), 1);
  assert.equal(gp.points.has("bo"), false);
  // ...and an answer naming only pulled questions is void: neither right nor wrong.
  assert.equal(G.isRight(TRIVIA, gp.verdicts.get("trivia|2"), two[1], two, pulled), null);
  // The batch written again after it was answered (new questions, new ids): every answer to it is void.
  const again = factsOf(s, keys({ 2: [item("n1", "a"), item("n2", "b")] }));
  const ga = A.grade(s, two, again);
  assert.equal(ga.points.size, 0);
  assert.equal(G.isRight(TRIVIA, ga.verdicts.get("trivia|2"), two[0], two, again), null);
  // No key read at all (a reader that isn't the server's): it waits, never graded as void.
  assert.equal(A.grade(s, answers, factsOf(s, null)).verdicts.get("trivia|3").state, "waiting");
});

test("its answer: { question id: one of its options }, only this round's questions", () => {
  const faces = new Set(["q1:a", "q1:b", "q2:a", "q2:b"]);
  const p = (v, f = faces) => G.answerProblem(G.fullSpec(game([TRIVIA])).ask[0], v, f);
  assert.equal(p({ q1: "a" }), null);
  assert.equal(p({ q1: "b", q2: "a" }), null);
  assert.match(p({}), /Answer one/);
  assert.match(p("a"), /Answer one/);
  assert.match(p({ q1: 2 }), /one of its options/);
  assert.match(p({ q1: "z" }), /this round's questions/);
  assert.match(p({ q7: "a" }), /this round's questions/);
  assert.match(p({ q1: "a" }, new Set()), /no trivia questions/);
  assert.equal(p({ q1: "a" }, null), null, "without faces, only its shape");
});

test("A9's ways of combining through its right answers: a split pot, a rollover", () => {
  const trivia = keys({ 2: [item("q1", "a"), item("q2", "b")], 3: [item("r1", "a")], 4: [item("t1", "a")] });
  // A pot of 6 split by right answers: ann two, bo one.
  const s = league(game([{ ...TRIVIA, points: 6, share: "split" }]));
  [0, 1, 2, 3].forEach((i, k) => boot(s, k + 1, i));
  const rows = said(2, { ann: { q1: "a", q2: "b" }, bo: { q1: "a", q2: "a" } });
  const g = A.grade(s, rows, factsOf(s, trivia));
  assert.equal(g.points.get("ann"), 4);
  assert.equal(g.points.get("bo"), 2);
  // A rollover: the premiere's round is void (no key) and nobody answered before Episode 2 or got it before 3, so each one's point
  // rides on to Episode 4's round: a void round carries its points, as any window that didn't count does.
  const r = league(game([{ ...TRIVIA, rollover: true }]));
  [0, 1, 2, 3].forEach((i, k) => boot(r, k + 1, i));
  const rr = said(3, { ann: { r1: "b" } }).concat(said(4, { bo: { t1: "a" } }));
  const gr = A.grade(r, rr, factsOf(r, trivia));
  assert.equal(gr.worth.get("trivia|4"), 4);
  assert.equal(gr.points.get("bo"), 4);
});

test("a life riding on it: a round with none right, or none answered, costs one; a void round costs nothing", () => {
  const s = league(game([TRIVIA], { lives: 2 }, { rank: { by: "standing" } }));
  const trivia = keys({ 2: [item("q1", "a")], 3: [item("r1", "a")] });
  [0, 1, 2, 3].forEach((i, k) => boot(s, k + 1, i));
  // Episode 1's round is void (no key): nobody loses one there. Before 2, ann right, bo wrong, cy silent; before 3, ann wrong again
  // only bo; before 4, no key: void again.
  const rows = said(2, { ann: { q1: "a" }, bo: { q1: "b" } }).concat(said(3, { ann: { r1: "a" }, bo: { r1: "b" }, cy: { r1: "a" } }));
  const w = A.walk(s, rows, factsOf(s, trivia));
  assert.equal(w.lives.ann, 2);
  assert.equal(w.lives.cy, 1, "silent at Episode 2");
  assert.equal(w.lives.bo, 0);
  assert.equal(w.out.bo, 3, "out after two wrong rounds");
  assert.equal(w.out.ann, undefined);
});

test("p1: bingo lines at 5 points with a stage of trivia alongside, the two ways of scoring added up", () => {
  const p1 = require("./fixtures/engine-capabilities.json").examples.find((x) => x.id === "p1");
  assert.ok(p1.spec, "the tracker's p1 carries its spec");
  assert.deepEqual(ats(G.specProblems(p1.spec, { ...CTX, calls: "results" })), []);
  assert.deepEqual(G.specWaitsFor(p1.spec), []);
  const stages = p1.spec.stages;
  assert.equal(stages.length, 2);
  assert.equal(stages[0].game.score.by, "lines");
  assert.equal(stages[0].game.score.points, 5);
  assert.equal(stages[1].alongside, true);
  assert.deepEqual(stages[1].game.ask.map((q) => [q.answer, q.points, q.asked]), [["trivia", 1, "each"]]);
});

test("a batch written again once its round has locked is added to, never replaced (storeTrivia's keep): the round keeps its key", async () => {
  const Trivia = require("../db/trivia-research.js");
  const run = async (opts) => {
    const said = [];
    const pool = { connect: async () => ({ query: async (sql) => (said.push(sql.trim().split(/\s+/)[0]), { rows: [] }), release() {} }) };
    const q = { episode: 5, kind: "text", question: "What was the reward?", options: ["a", "b", "c", "d"], answer: "a", why: null, source: "https://x.invalid", status: "live", note: null };
    const live = await Trivia.storeTrivia(pool, "s", 5, [q, { ...q, status: "dropped" }], null, opts);
    return { said, live };
  };
  assert.deepEqual(await run(), { said: ["BEGIN", "DELETE", "INSERT", "INSERT", "COMMIT"], live: 1 }, "before its round locks, a new batch replaces the old");
  assert.deepEqual(await run({ keep: true }), { said: ["BEGIN", "INSERT", "INSERT", "COMMIT"], live: 1 }, "after, it's added");
});
