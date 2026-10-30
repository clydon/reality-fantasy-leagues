// Questions settled by data (docs/PLAN-start-a-game-gpt.md step A4): a game spec's `ask` (game-spec schema.js), graded by
// game-spec answers.js from the league's own results (state-logic.js AnswerLogic). The questions' shape and the
// data-can-settle rule for every one of them; each kind of answer graded; a game of questions played from its spec, at a
// viewer's mark; the lock (closedForPlay); side bets' lock, and side bets only where they count; finale predictions settled
// by the results, scoring what the hand-entered result did; Weekly Calls as the show's calls. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { tableOf } = jiti("../src/lib/game/game-view.ts");

const clone = (v) => JSON.parse(JSON.stringify(v));
const ats = (problems) => problems.map((p) => p.at);
const HOUR = 3600 * 1000;

/** A league as Start a game makes one, on Survivor, with `n` castaways and players ann, bo and cy. */
function league(type, n = 8, after) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", type);
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < n; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  if (after) after(s);
  S.updateSettings(s, "setupComplete", true);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => S.ensureEpisodeNumber(s, n, false);
/** Who went home in episode n (castaway indexes, in the order the results came in), and what happened in it. */
function results(s, n, outs, events = [], stage) {
  const e = ep(s, n);
  for (const [i, method] of outs.map((o) => (Array.isArray(o) ? o : [o, "Voted Out"]))) S.addElimination(s, e.id, cid(s, i), method);
  for (const [type, i, units] of events) S.addScoringEvent(s, e.id, type, cid(s, i), units);
  if (!outs.length && !events.length) S.EpisodeLogic.setNoExit(s, e.id, true);
  if (stage) S.setResultsStage(s, e.id, stage);
  return e;
}

/** The ctx Start a game and the GPT pass for Survivor's rules (answers.ts questionContext): research's moments and the couch's. */
const CTX = {
  moments: [
    { id: "idolPlayed", label: "Played an idol", defaultPoints: 1, answeredBy: "research" },
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "cried", label: "Cried at tribal", defaultPoints: 0, answeredBy: "league" },
  ],
  results: true,
  winner: true,
  calls: "results",
};
const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const IDOL = { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
const WINS = { id: "wins", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } };
const game = (ask, extra) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask, ...extra });

test("the questions' shape: when each is asked and closes, how many to name, and what each kind takes", () => {
  const at = (q, extra) => ats(G.specProblems(game([q], extra)));
  assert.deepEqual(at(OUT), []);
  assert.deepEqual(at(WINS), [], "asked once, closing when the game starts");
  assert.deepEqual(G.fullSpec(game([WINS])).ask[0], { ...WINS, asked: "once", closes: "start", pick: 1, from: "cast" });
  assert.deepEqual(at({ ...WINS, asked: "each" }), ["ask[0].asked"], "who wins is the season's: asked once");
  assert.deepEqual(at(WINS, { span: { from: 1, to: 6 } }), ["ask[0].settle"], "known at the season's end, so the game runs to it");
  assert.deepEqual(at({ ...OUT, closes: "finale" }), ["ask[0].closes"], "only a question asked once waits for the finale");
  assert.deepEqual(at({ ...WINS, closes: "finale" }), []);
  assert.deepEqual(at({ ...IDOL, asked: "once", closes: "finale" }), ["ask[0].closes"], "anything but who wins or the final few could be settled before the finale");
  // A league's own keeps what it already plays (classic let finale predictions be on a game with an end, at any points).
  const spanned = { ...G.PRESETS.outlast, span: { from: 1, to: 6 }, ask: G.finaleQuestions({ top3: 150, winner: 3, from: "any" }) };
  assert.ok(G.specProblems(spanned).length > 0);
  assert.deepEqual(G.specProblems(spanned, null, { league: true }), []);
  assert.deepEqual(at({ ...OUT, pick: 11 }), ["ask[0].pick"]);
  assert.deepEqual(at({ ...OUT, from: "team" }), ["ask[0].from"], "only a draft has teams");
  assert.deepEqual(at({ ...IDOL, pick: 2 }), ["ask[0].pick"]);
  assert.deepEqual(at({ ...IDOL, line: 2 }), ["ask[0].line"]);
  assert.deepEqual(at({ ...IDOL, id: "no spaces" }), ["ask[0].id"]);
  assert.deepEqual(at({ ...IDOL, points: 101 }), ["ask[0].points"]);
  assert.deepEqual(at({ ...IDOL, answer: "choice", options: ["Yes", "Maybe"] }), ["ask[0].options"], "whether it happened is yes or no");
  assert.deepEqual(at({ ...IDOL, answer: "choice", options: ["Yes", "No"] }), []);
  const count = { id: "n", ask: "How many idols?", answer: "choice", points: 1, settle: { by: "moment", moment: "idolPlayed", take: "count" }, options: ["0", "1-2", "3+"] };
  assert.deepEqual(at(count), []);
  assert.deepEqual(at({ ...count, options: ["0", "lots"] }), ["ask[0].options"]);
  assert.deepEqual(at({ ...count, options: ["0", "0"] }), ["ask[0].options"]);
  assert.deepEqual(at({ ...count, answer: "overUnder", options: undefined, line: 1.5 }), []);
  assert.deepEqual(at({ ...count, answer: "overUnder", options: undefined, line: "x" }), ["ask[0].line"]);
  // The show's calls are Weekly Calls' alone, a point each.
  assert.deepEqual(ats(G.specProblems(game([G.CALLS, IDOL]))), ["ask[0]"]);
  assert.deepEqual(ats(G.specProblems(game([{ ...G.CALLS, points: 2 }]))), ["ask[0].points"]);
  assert.deepEqual(ats(G.specProblems(game([{ ...IDOL, settle: { by: "calls" } }]))), ["ask[0].settle", "ask[0].answer"]);
  assert.deepEqual(ats(G.specProblems(game([OUT, { ...OUT }]))), ["ask[1].id"]);
  assert.deepEqual(ats(G.specProblems({ ...G.PRESETS.outlast, score: { by: "answers" } })), ["score.by", "ask"], "nothing held, and something to answer");
  // What a spec still waits for: an over/under's line, then nothing.
  assert.deepEqual(G.specWaitsFor(game([{ ...count, answer: "overUnder", options: undefined, line: null }])).map((w) => [w.at, w.step]), [["ask[0].line", null]]);
  assert.deepEqual(G.specWaitsFor(game([OUT, IDOL])), []);
  assert.equal(G.typeOf(game([OUT, IDOL])), "questions");
  assert.equal(G.typeOf({ ...G.PRESETS["survival-pool"], ask: [OUT] }), null, "a pool asks nothing else yet");
});

test("the data-can-settle rule holds for every question: research's moments, a winner to crown, the couch's word only a league's own keeps", () => {
  const at = (ask, ctx, opts) => ats(G.specProblems(game(ask), ctx, opts));
  assert.deepEqual(at([OUT, IDOL, WINS], CTX), []);
  const cried = { ...IDOL, id: "cried", settle: { ...IDOL.settle, moment: "cried" } };
  assert.deepEqual(at([cried], CTX), ["ask[0].settle.moment"], "the couch's word can't settle it");
  assert.deepEqual(at([{ ...IDOL, settle: { ...IDOL.settle, moment: "dances" } }], CTX), ["ask[0].settle.moment"], "not one of the show's moments");
  assert.deepEqual(at([WINS], { ...CTX, winner: false }), ["ask[0].settle"], "nobody wins this show");
  assert.deepEqual(at([OUT], { ...CTX, results: false }), ["ask[0].settle"], "a series' results don't say who goes home");
  // The show's calls on a talk show are the couch's word: Weekly Calls keeps them (a league's own), the GPT can't make them.
  const calls = G.PRESETS["weekly-calls"];
  assert.deepEqual(ats(G.specProblems(calls, { ...CTX, calls: "couch" })), ["ask[0].settle"]);
  assert.deepEqual(ats(G.specProblems(calls, { ...CTX, calls: "couch" }, { league: true })), []);

  // Every write goes through setGame, which checks a game's own questions against the show: never without it.
  const s = league("pickem");
  assert.deepEqual(ats(S.setGame(s, game([OUT, IDOL]))), ["ask"], "no ctx: nothing to check them against");
  assert.deepEqual(ats(S.setGame(s, game([cried]), { ctx: CTX })), ["ask[0].settle.moment"]);
  assert.deepEqual(S.setGame(s, game([OUT, IDOL]), { ctx: CTX }), []);
  assert.equal(S.getLeagueType(s).id, "questions");
  assert.deepEqual(s.settings.questions, G.fullSpec(game([OUT, IDOL])).ask, "written to the field that says them");
  // A change to anything else needs no ctx (the questions stay as they were); finale predictions and Weekly Calls are presets.
  assert.deepEqual(S.updateSettings(s, "lockedDown", true), []);
  const o = league("classic-draft");
  assert.deepEqual(S.updateSettings(o, "finalePredictionsEnabled", true), []);
  assert.deepEqual(G.finaleOf(S.gameOf(o).ask), { top3: 1, winner: 3, from: "any" });
});

test("grading each kind of answer from what the results say", () => {
  const facts = (o) => ({ from: 1, to: null, over: false, episodes: new Map(), winner: null, ended: false, order: null, names: new Map(), ...o });
  const ep1 = { out: ["a"], events: new Map([["idolPlayed", 2]]) };
  const f = facts({ episodes: new Map([[1, ep1], [2, { out: [], events: null }], [3, { out: null, events: null }]]) });
  const q = (x) => G.fullQuestion(x);
  const grade = (qq, n, answers, ff = f) => Object.fromEntries(G.pointsFor(q(qq), G.verdictOf(q(qq), n, ff), answers, ff));
  // Who goes home, each episode: right, nobody went home (off), still to come.
  assert.deepEqual(grade(OUT, 1, [{ playerId: "ann", answer: "a" }, { playerId: "bo", answer: "b" }]), { ann: 2 });
  assert.deepEqual(G.verdictOf(q(OUT), 2, f), { state: "off", why: "Nobody went home" });
  assert.deepEqual(G.verdictOf(q(OUT), 3, f), { state: "waiting" });
  // Asked once: the first to go in the game, once every episode before it is in.
  const first = { ...OUT, asked: "once" };
  assert.deepEqual(G.verdictOf(q(first), 0, f), { state: "known", right: ["a"] });
  assert.deepEqual(G.verdictOf(q(first), 0, facts({ episodes: new Map([[2, ep1]]) })), { state: "waiting" }, "Episode 1 isn't in yet");
  // Whether a moment happened: the episode's full results, or over the game (yes as soon as it does).
  assert.deepEqual(grade(IDOL, 1, [{ playerId: "ann", answer: "yes" }, { playerId: "bo", answer: "no" }]), { ann: 1 });
  assert.deepEqual(G.verdictOf(q(IDOL), 2, f), { state: "waiting" }, "only who went home is in");
  assert.deepEqual(G.verdictOf(q({ ...IDOL, asked: "once" }), 0, f), { state: "known", right: ["yes"] });
  assert.deepEqual(G.verdictOf(q({ ...IDOL, asked: "once", settle: { ...IDOL.settle, moment: "quit" } }), 0, f), { state: "waiting" }, "no until the game is over");
  // A count: the closest wins (ties all), an over/under against its line (right on it is off), a choice's range.
  const many = { id: "many", ask: "How many idols?", answer: "number", points: 3, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "count" } };
  assert.deepEqual(grade(many, 1, [{ playerId: "ann", answer: 1 }, { playerId: "bo", answer: 3 }, { playerId: "cy", answer: 5 }]), { ann: 3, bo: 3 });
  assert.deepEqual(grade({ ...many, answer: "overUnder", line: 1.5 }, 1, [{ playerId: "ann", answer: "over" }, { playerId: "bo", answer: "under" }]), { ann: 3 });
  assert.deepEqual(grade({ ...many, answer: "overUnder", line: 2 }, 1, [{ playerId: "ann", answer: "over" }]), {}, "right on the line");
  assert.deepEqual(grade({ ...many, answer: "choice", options: ["0", "1-2", "3+"] }, 1, [{ playerId: "ann", answer: "1-2" }, { playerId: "bo", answer: "3+" }]), { ann: 3 });
  // A choice of names, matched to who went home.
  const named = facts({ episodes: f.episodes, names: new Map([["a", "Ana Ruiz"]]) });
  assert.deepEqual(grade({ ...OUT, answer: "choice", options: ["Ana Ruiz", "Ben"] }, 1, [{ playerId: "ann", answer: "Ana Ruiz" }], named), { ann: 2 });
  // The season's: the winner, the top 3 (each one named right scores), a place.
  const end = facts({ winner: "w", ended: true, order: ["w", "r", "t", "f"] });
  const top3 = { id: "top3", ask: "Final three?", answer: "person", points: 1, pick: 3, settle: { by: "results", take: "top", place: 3 } };
  assert.deepEqual(grade(top3, 0, [{ playerId: "ann", answer: ["w", "f", "t"] }, { playerId: "bo", answer: ["f"] }], end), { ann: 2 });
  assert.deepEqual(grade(WINS, 0, [{ playerId: "ann", answer: "w" }, { playerId: "bo", answer: "r" }], end), { ann: 5 });
  assert.deepEqual(G.verdictOf(q({ ...WINS, settle: { by: "results", take: "placed", place: 2 } }), 0, end), { state: "known", right: ["r"] });
  assert.deepEqual(G.verdictOf(q(WINS), 0, facts()), { state: "waiting" });
  // Whether one answer was right, and what an answer has to be.
  assert.equal(G.isRight(q(many), G.verdictOf(q(many), 1, f), { playerId: "bo", answer: 3 }, [{ playerId: "ann", answer: 1 }, { playerId: "bo", answer: 3 }], f), true);
  assert.equal(G.isRight(q(OUT), G.verdictOf(q(OUT), 3, f), { playerId: "bo", answer: "a" }, [], f), null);
  const faces = new Set(["a", "b"]);
  assert.equal(G.answerProblem(q(OUT), "a", faces), null);
  assert.equal(G.answerProblem(q(OUT), "z", faces), "Name someone still in");
  assert.equal(G.answerProblem(q(OUT), ["a", "b"], faces), "Name one");
  assert.equal(G.answerProblem(q(top3), ["a", "a"], faces), "Name each one once");
  assert.equal(G.answerProblem(q(IDOL), "maybe"), "Yes or no");
  assert.equal(G.answerProblem(q(many), -1), "A number, 0 or more");
});

test("a game of questions plays from its spec, graded from its own results as far as each viewer has seen", () => {
  const s = league("pickem", 8);
  assert.deepEqual(S.setGame(s, game([OUT, IDOL, WINS]), { ctx: CTX }), []);
  const t = S.getLeagueType(s);
  assert.deepEqual([t.id, !!t.hasQuestions, !!t.hasCalls, !!t.hasRoster], ["questions", true, false, false]);
  results(s, 1, [0], [["idolPlayed", 3]]);
  results(s, 2, [1]);
  const answers = [
    { playerId: "ann", question: "out", episode: 1, answer: cid(s, 0) },
    { playerId: "bo", question: "out", episode: 1, answer: cid(s, 5) },
    { playerId: "ann", question: "idol", episode: 1, answer: "yes" },
    { playerId: "cy", question: "idol", episode: 1, answer: "no" },
    { playerId: "bo", question: "out", episode: 2, answer: cid(s, 1) },
    { playerId: "cy", question: "wins", episode: 0, answer: cid(s, 7) },
    { playerId: "cy", question: "nope", episode: 1, answer: "x" },
  ];
  const all = S.AnswerLogic.grade(s, answers).points;
  assert.deepEqual(Object.fromEntries(all), { ann: 3, bo: 2 });
  // Only the players this copy of the league has: a late joiner someone can't see (viewFor takes them out) counts for nothing.
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(s, [...answers, { playerId: "ghost", question: "out", episode: 1, answer: cid(s, 0) }]).points), { ann: 3, bo: 2 });
  // As someone who's seen only Episode 1 sees it: Episode 2's answers are still to settle.
  const view = S.GhostLogic.viewFor(s, "ann", 1);
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(view, answers).points), { ann: 3 });
  // Its table ranks by them (game-view.ts tableOf, as Weekly Calls' by its calls); the state scores nothing itself.
  assert.deepEqual(S.computeScores(s).map((r) => r.total), [0, 0, 0]);
  const rows = tableOf(s, "ann", () => null, (p) => all.get(p) ?? 0);
  assert.deepEqual(rows.map((r) => [r.playerId, r.total, r.rank]), [["ann", 3, "1"], ["bo", 2, "2"], ["cy", 0, "3"]]);
  // Its fields say it whole: written back from them, it reads as the same spec; How it works says each question.
  assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, S.gameOf(s))), S.gameOf(s));
  assert.deepEqual(G.describeSpec(S.gameOf(s)).rules, [
    "No draft, no team. Answer three questions:",
    "Before each episode: Who goes home? 2 points if you're right.",
    "Before each episode: An idol played? 1 point if you're right.",
    "Before it starts: Who wins? 5 points if you're right.",
    "Change an answer until its episode starts. Nobody sees them until then.",
    "Most points wins.",
  ]);
});

test("the lock: a question closes when its episode starts (as a lineup does), once it has results or it's settled, and finale predictions at the finale", () => {
  const s = league("pickem", 6);
  S.setGame(s, game([OUT, WINS]), { ctx: CTX });
  const q = (id) => S.AnswerLogic.questions(s).find((x) => x.id === id);
  const now = Date.parse("2026-11-01T12:00:00Z");
  const e1 = ep(s, 1);
  e1.airsAt = new Date(now + HOUR).toISOString();
  assert.equal(S.AnswerLogic.closed(s, q("out"), 1, { now }), false);
  assert.equal(S.AnswerLogic.closed(s, q("wins"), 0, { now }), false, "asked once, it closes when the game's first episode starts");
  e1.airsAt = new Date(now - HOUR).toISOString();
  assert.equal(S.AnswerLogic.closed(s, q("out"), 1, { now }), true, "it started");
  assert.equal(S.AnswerLogic.closed(s, q("wins"), 0, { now }), true);
  e1.openPastAir = true;
  assert.equal(S.AnswerLogic.closed(s, q("out"), 1, { now }), false, "whoever runs it kept it open");
  e1.openPastAir = false;
  e1.airsAt = new Date(now + HOUR).toISOString();
  e1.lineupsLocked = true;
  assert.equal(S.AnswerLogic.closed(s, q("out"), 1, { now }), true, "or locked it early");
  delete e1.lineupsLocked;
  // An episode the league hasn't made yet locks by the schedule's air time; one the game doesn't play is closed.
  assert.equal(S.AnswerLogic.closed(s, q("out"), 3, { now, airAt: new Date(now - HOUR).toISOString() }), true);
  assert.equal(S.AnswerLogic.closed(s, q("out"), 3, { now, airAt: new Date(now + HOUR).toISOString() }), false);
  // A league catching up at its own pace isn't on the broadcast's clock (air-times.ts leaves its episodes unstamped).
  const behind = clone(s);
  behind.settings.revealedThroughEpisode = 0;
  assert.equal(S.AnswerLogic.closed(behind, q("out"), 3, { now, airAt: new Date(now - HOUR).toISOString() }), false);
  results(s, 1, [0]);
  assert.equal(S.AnswerLogic.closed(s, q("out"), 1, { now }), true, "results close it for good");
  // Finale predictions close when the season's last episode starts (the schedule's count), and once they're settled.
  const o = league("classic-draft", 6, (x) => S.updateSettings(x, "finalePredictionsEnabled", true));
  const top3 = S.AnswerLogic.questions(o).find((x) => x.id === "top3");
  assert.equal(S.AnswerLogic.closed(o, top3, 0, { now, finale: 6, airAt: new Date(now + HOUR).toISOString() }), false);
  assert.equal(S.AnswerLogic.closed(o, top3, 0, { now, finale: 6, airAt: new Date(now - HOUR).toISOString() }), true);
  assert.equal(S.AnswerLogic.closed(o, top3, 0, { now }), false, "no finale listed: open until the results settle it");
  for (let i = 0; i < 4; i++) results(o, i + 1, [i]);
  results(o, 5, [[4, "Lost Final Tribal (Jury Vote)"], [5, "Sole Survivor"]]);
  assert.equal(S.AnswerLogic.closed(o, top3, 0, { now }), true, "the season's over");
});

test("side bets lock at their episode's start, as a lineup does, and count only beside a draft", () => {
  const s = league("active-roster", 6);
  const now = Date.now();
  const e = ep(s, 1);
  e.airsAt = new Date(now + HOUR).toISOString();
  const bet = S.addBet(s, e.id, "Does anyone cry?", 2, "ann");
  assert.ok(bet);
  const guess = S.addBetPrediction(s, e.id, bet.id, "ann", "Yes");
  assert.ok(guess);
  e.airsAt = new Date(now - HOUR).toISOString();
  assert.equal(S.BetLogic.closed(e), true);
  assert.equal(S.addBetPrediction(s, e.id, bet.id, "bo", "No"), undefined, "no guess after it starts");
  S.removeBetPrediction(s, e.id, bet.id, guess.id);
  assert.equal(e.bets[0].predictions.length, 1, "nor taking one back");
  assert.equal(S.addBet(s, e.id, "Late one?", 1, "ann"), undefined, "nor a new bet on it");
  e.openPastAir = true;
  assert.equal(S.BetLogic.closed(e), false, "kept open past its start by whoever runs it");
  // Only a draft scores them, so only a draft offers them: a pool, Weekly Calls and Weekly Bingo say nothing of them.
  assert.deepEqual(S.betsOn(s), { points: 1 });
  for (const type of ["pickem", "weekly-calls", "weekly-bingo"]) {
    const x = league(type);
    assert.equal(x.settings.bonusEnabled, true, `${type}: switched on, as every new game is`);
    assert.equal(S.betsOn(x), null, `${type}: but never offered`);
    assert.ok(!G.describeSpec(S.gameOf(x)).rules.some((r) => r.startsWith("Predictions")), `${type}: nor on its Rules sheet`);
  }
  assert.deepEqual(ats(G.specProblems({ ...G.PRESETS["survival-pool"], extras: { ...G.PRESETS["survival-pool"].extras, bets: { points: 1 } } })), ["extras.bets"]);
});

/** The finale scoring before A4 (state-logic.js addSideLayers at ee0942ca): graded against the result typed in by hand. */
function finaleBefore(state) {
  const st = state.settings;
  const out = new Map();
  if (!st.finalePredictionsEnabled || !(state.finaleActual && state.finaleActual.winner)) return out;
  for (const fp of state.finalePredictions || []) {
    const top3 = (fp.top3 || []).filter((id) => id && state.finaleActual.top3.includes(id)).length * (st.finaleTop3Points || 0);
    out.set(fp.playerId, top3 + (fp.winner && fp.winner === state.finaleActual.winner ? st.finaleWinnerPoints || 0 : 0));
  }
  return out;
}

test("finale predictions: settled by the results, scoring what the result typed in by hand did", () => {
  for (const type of ["classic-draft", "active-roster"]) {
    for (const scope of ["open", "ownPicksOnly"]) {
      const s = league(type, 8, (x) => {
        S.updateSettings(x, "finalePredictionsEnabled", true);
        S.updateSettings(x, "finaleTop3Points", 2);
        S.updateSettings(x, "finaleWinnerPoints", 5);
        S.updateSettings(x, "finalePredictionScope", scope);
      });
      // Everyone names a final three and a winner.
      const pick = (pid, top3, winner) => { top3.forEach((i, k) => S.setFinalePick(s, pid, k, cid(s, i))); S.setFinaleWinnerPick(s, pid, cid(s, winner)); };
      pick("ann", [7, 6, 5], 7);
      pick("bo", [7, 0, 1], 6);
      pick("cy", [2, 3, 4], 2);
      for (let i = 0; i < 4; i++) results(s, i + 1, [i]);
      assert.deepEqual(Object.fromEntries(S.AnswerLogic.finalePoints(s)), {}, `${type}: nothing while the season runs`);
      // The finale: the fire-making loser, then the vote (its results in any order: the winner came in first).
      results(s, 5, [[7, "Sole Survivor"], [4, "Lost Fire-Making"], [6, "Lost Final Tribal (Jury Vote)"], [5, "Lost Final Tribal (Jury Vote)"]]);
      const actual = S.AnswerLogic.finaleActual(s);
      assert.equal(actual.winner, cid(s, 7));
      assert.deepEqual([...actual.top3].sort(), [7, 6, 5].map((i) => cid(s, i)).sort());
      const order = S.AnswerLogic.finishOrder(s);
      assert.deepEqual([order[0], new Set(order.slice(1, 3)), order[3]], [cid(s, 7), new Set([cid(s, 6), cid(s, 5)]), cid(s, 4)], "the winner, the finalists, then who lost the fire");
      // Before A4 whoever ran it typed that in: graded against it, every finale score is the same, and so is every total.
      const typed = clone(s);
      typed.finaleActual = { top3: [cid(s, 5), cid(s, 7), cid(s, 6)], winner: cid(s, 7) };
      const now = Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.finale]));
      assert.deepEqual(now, Object.fromEntries(finaleBefore(typed)), `${type}, ${scope}`);
      assert.deepEqual(now, { ann: 2 * 3 + 5, bo: 2, cy: 0 });
      // A result typed in that the results don't say counts for nothing now: only data settles it.
      typed.finaleActual = { top3: [cid(s, 0), cid(s, 1), cid(s, 2)], winner: cid(s, 2) };
      assert.deepEqual(S.computeScores(typed).map((r) => r.finale), S.computeScores(s).map((r) => r.finale));
      // Spoiler-safe: someone who hasn't seen the finale sees nothing settled.
      const view = S.GhostLogic.viewFor(s, "ann", 4);
      assert.deepEqual(S.computeScores(view).map((r) => r.finale), [0, 0, 0]);
      assert.deepEqual(S.AnswerLogic.finaleActual(view), { top3: [null, null, null], winner: null });
    }
  }
  // The finalists by their jury votes, whatever order they came in.
  const s = league("classic-draft", 4);
  results(s, 1, [0]);
  const e = ep(s, 2);
  S.addElimination(s, e.id, cid(s, 1), "Lost Final Tribal (Jury Vote)", 2);
  S.addElimination(s, e.id, cid(s, 2), "Lost Final Tribal (Jury Vote)", 5);
  S.addElimination(s, e.id, cid(s, 3), "Sole Survivor", 7);
  assert.deepEqual(S.AnswerLogic.finishOrder(s), [3, 2, 1, 0].map((i) => cid(s, i)));
});

test("Weekly Calls is the show's calls, an ask preset scored by its answers, as it always played", () => {
  const p = G.PRESETS["weekly-calls"];
  assert.deepEqual(p.ask, [G.CALLS]);
  assert.deepEqual(p.score, { by: "answers" });
  assert.equal(G.typeOf(p), "weekly-calls");
  const s = league("weekly-calls");
  const t = S.getLeagueType(s);
  assert.deepEqual([!!t.hasCalls, !!t.hasQuestions], [true, false]);
  assert.deepEqual(S.gameOf(s).ask, [G.CALLS]);
  assert.deepEqual(S.AnswerLogic.grade(s, [{ playerId: "ann", question: "calls", episode: 1, answer: "x" }]).points.size, 0, "its calls are Call it's (calls.ts), not graded here");
  // And finale predictions are a draft's two questions, as their fields say them.
  const o = league("classic-draft", 4, (x) => { S.updateSettings(x, "finalePredictionsEnabled", true); S.updateSettings(x, "finalePredictionScope", "ownPicksOnly"); });
  assert.deepEqual(S.gameOf(o).ask, G.finaleQuestions({ top3: 1, winner: 3, from: "own" }));
  assert.deepEqual(S.gameOf(o).ask.map((q) => [q.id, q.from, q.closes, q.pick]), [["top3", "team", "finale", 3], ["winner", "team", "finale", 1]]);
  assert.equal(G.typeOf({ ...S.gameOf(o), ask: [S.gameOf(o).ask[1]] }), null, "half of them isn't a game today");
});

test("a Prediction Sheet's questions from the show's moments: only what data settles, the recommended ones on (A4 part 2)", () => {
  const { questionChoices, chosenQuestions, contextOf, questionLine } = jiti("../src/lib/game/question-choices.ts");
  const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
  const SAMPLES = require("./fixtures/rulebook-samples.js");
  const book = (b) => (b.blocks ? b : { blocks: b, aliases: null });
  const survivor = BUILT_IN_BLOCKS.survivor;
  const ctx = contextOf(survivor);
  const choices = questionChoices(survivor, ctx);
  const ids = choices.map((c) => c.question.id);
  assert.deepEqual(ids.slice(0, 1), ["out"]);
  assert.ok(ids.includes("wins") && ids.includes("final3") && ids.includes("first"), ids.join());
  assert.deepEqual(choices.filter((c) => c.on).map((c) => c.question.id), ["out", ids.find((id) => id.startsWith("m.")), "wins"], "Who goes home?, the first moment and Who wins? are on");
  // Every moment question is one research answers, by the id the results record.
  for (const c of choices.filter((x) => x.question.settle.by === "moment")) {
    const m = ctx.moments.find((x) => x.id === c.question.settle.moment);
    assert.ok(m && (m.answeredBy === "research" || m.auto), c.question.id);
    assert.equal(c.question.answer, "yesNo");
  }
  assert.equal(questionLine(choices[0].question), "Each episode · 2 points");
  assert.equal(choices.find((c) => c.question.id === "final3").line, "Once, before it starts · 1 point each");
  // The couch's word never settles one: a moment the couch answers isn't offered.
  const moment = choices.find((c) => c.question.settle.by === "moment").question.settle.moment;
  const couch = { ...ctx, moments: ctx.moments.map((m) => (m.id === moment ? { ...m, answeredBy: "league" } : m)) };
  assert.ok(!questionChoices(survivor, couch).some((c) => c.question.settle.moment === moment));
  // Nobody wins: no Who wins? or final three. A series: its moments only. A talk show: nothing (its moments are the couch's word).
  assert.ok(!questionChoices(survivor, { ...ctx, winner: false }).some((c) => c.season));
  const series = questionChoices(book(SAMPLES.belowDeck), contextOf(book(SAMPLES.belowDeck)));
  assert.ok(series.length > 0 && series.every((c) => c.question.answer === "yesNo"), series.map((c) => c.question.id).join());
  assert.deepEqual(questionChoices(book(SAMPLES.snl), contextOf(book(SAMPLES.snl))), []);
  // A game over a span leaves out the season's.
  assert.deepEqual(chosenQuestions(choices, ["out", "wins"], false).map((q) => q.id), ["out"]);
  assert.deepEqual(chosenQuestions(choices, ["wins", "out", "nope"], true).map((q) => q.id), ["out", "wins"], "in the order offered, unknown ids left out");
  // Written through the game's writer with the show's ctx: a game of questions, its spec carried; refused without the ctx.
  const s = league("weekly-calls");
  const ask = chosenQuestions(choices, choices.filter((c) => c.on).map((c) => c.question.id), true);
  const spec = { ...S.gameOf(s), preset: null, get: { by: "none" }, count: null, score: { by: "answers" }, ask };
  assert.ok(S.setGame(clone(s), spec).some((p) => p.at.startsWith("ask")), "the data rule: no ctx, no new questions");
  assert.deepEqual(S.setGame(s, spec, { ctx }), []);
  assert.equal(s.settings.leagueTypeId, "questions");
  assert.deepEqual(S.AnswerLogic.questions(s).map((q) => q.id), ask.map((q) => q.id));
  assert.ok(S.getLeagueType(s).hasQuestions);
});

test("a Prediction Sheet's night: its points and how many were right, a night that didn't count, a sheet only for the season (A4 part 2)", () => {
  const { nightIn } = jiti("../src/lib/game/episode-view.ts");
  const s = league("pickem");
  const ask = [
    { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } },
    { id: "wins", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } },
  ];
  const ctx = { moments: [], results: true, winner: true };
  assert.deepEqual(S.setGame(s, { ...S.gameOf(s), preset: null, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask }, { ctx }), []);
  const e = results(s, 1, [0]);
  const game = { leagueId: "g", name: "Prediction Sheet", gameType: "questions", gameName: "Prediction Sheet" };
  const night = (n) => nightIn(game, s, "ann", e, new Map(n ? [[1, n]] : []));
  assert.deepEqual([night({ answered: 1, settled: 1, off: 0, right: 1, earned: 2 }).big, night({ answered: 1, settled: 1, off: 0, right: 1, earned: 2 }).line], ["+2 pts", "1 of 1 right"]);
  assert.equal(night({ answered: 1, settled: 1, off: 1, right: 0, earned: 0 }).line, "It didn't count", "nobody went home: not a wrong answer");
  assert.equal(night({ answered: 1, settled: 0, off: 0, right: 0, earned: 0 }).big, "Waiting");
  assert.ok(night(null).missed, "no answer from you: a miss");
  assert.equal(nightIn(game, s, "ann", e).line, "See how your sheet went", "its answers unread: never called a miss");
  // A sheet that asks only for the season has nothing for an episode, and that isn't a miss.
  assert.deepEqual(S.setGame(s, { ...S.gameOf(s), ask: [ask[1]] }, { ctx }), []);
  const only = night(null);
  assert.deepEqual([only.line, !!only.missed], ["Its questions are for the season", false]);
});
