// A draft's own questions beyond its finale predictions (docs/PLAN-start-a-game-gpt.md track C, C2 part 4c): their answers graded as
// a game of questions' are (AnswerLogic.grade: every way their points combine), by the server, which hands the draft's copy their
// points through each episode and now (AnswerLogic.lines, withLines: `answerLines`, never stored), so the draft's one walk adds them
// as a line of their own (ScoringLogic.walk: the series, the table at now; each row's `questions`), and head to head (its final
// settling the questions about the whole game) and teams of players play on them; its cuts and a race wait (who's out decides the
// moves the league's own writes take, which read it as stored). A copy without them scores the questions as nothing (the safe
// fallback). Their shape, settings and words, and what's still refused. On one made-up season whose every number is worked out by hand below. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const CTX = {
  moments: ["individualImmunity", "idolPlayed"].map((id) => ({ id, label: id, defaultPoints: 1, answeredBy: "research" })),
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};
const ats = (problems) => problems.map((p) => p.at);
const SEATS = ["ann", "bo", "cy", "di"];
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const POT = { id: "pot", ask: "Who wins immunity? 2 points, split", answer: "person", points: 2, asked: "each", share: "split", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const IDOLS = { id: "idols", ask: "How many idols get played in the game?", answer: "number", points: 4, settle: { by: "moment", moment: "idolPlayed", take: "count" } };
const FINALE = G.finaleQuestions({ top3: 1, winner: 3, from: "any" });
/** An Outlast of two each (seat i: c(2i) and c(2i+1); c8 and c9 free), asking `ask`, ranked `rank`. */
const outlast = (ask, rank = { by: "total" }) => ({ preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, ask, rank });

/**
 * Ten castaways, five episodes, one goes home each: c8 (free), c3 (bo's), c9 (free), c5 (cy's), c7 (di's). An Outlast's points (1
 * plus each boot outlasted; still in, 1 plus the boots so far), each seat through each episode:
 *   ann 4 6 8 10 12   bo 4 5 6 7 8   cy 4 6 8 9 10   di 4 6 8 10 11
 * Immunity: c0, c4, c0, c6, c2 (one each, at 1.1 units: a lineup's 1.1 points). Idols played: Episode 2 and 3 (and 5).
 */
const EXITS = ["c8", "c3", "c9", "c5", "c7"];
const IMMUNE = ["c0", "c4", "c0", "c6", "c2"];
function league(spec, more = {}) {
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor", setupComplete: true },
    players: SEATS.map((id) => ({ id, name: id, color: "#000" })),
    draftOrder: SEATS.slice(),
    tribes: [{ id: "t1", name: "Toka", color: "#111" }],
    castaways: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, status: "active", tribeId: "t1", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: Array.from({ length: 6 }, (_, i) => ({ id: `e${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  SEATS.forEach((p, i) => [2 * i, 2 * i + 1].forEach((k) => { s.castaways[k].ownerIds.push(p); s.castaways[k].acquiredVia = "draft"; }));
  for (let n = 1; n <= 5; n++) {
    const ep = s.episodes[n - 1];
    ep.scoringEvents.push({ id: `i${n}`, type: "individualImmunity", castawayId: IMMUNE[n - 1], units: 1.1 });
    if (n === 2 || n === 3 || n === 5) ep.scoringEvents.push({ id: `p${n}`, type: "idolPlayed", castawayId: "c1" });
    S.EpisodeLogic.addElimination(s, ep.id, EXITS[n - 1], "Voted Out");
  }
  if (more.teams) {
    s.teamSeats = { ann: [{ team: "t1", from: 1 }], bo: [{ team: "t1", from: 1 }], cy: [{ team: "t2", from: 1 }], di: [{ team: "t2", from: 1 }] };
    s.teamDraw = { seed: "zt-teams", kept: true };
  }
  return s;
}
/** Answers as game_answers holds them: { question: { episode: { seat: answer } } }. */
const rowsOf = (by) => Object.entries(by).flatMap(([question, eps]) => Object.entries(eps).flatMap(([n, seats]) => Object.entries(seats).map(([playerId, answer]) => ({ playerId, question, episode: Number(n), answer }))));
/**
 * Who goes home (2 points each right one): Episode 1 ann and cy (c8), 2 ann and di (c3), 3 bo (c9), 4 cy and di (c5), 5 bo (c7).
 * Who wins immunity (2 points split between everyone right): 1 ann and bo (1 each), 2 cy (2), 3 ann, bo and cy (0.67 each), 4 di (2),
 * 5 bo, cy and di (0.67 each). Through each episode:
 *   ann 3 5 5.67 5.67 5.67   bo 1 1 3.67 3.67 6.34   cy 2 4 4.67 6.67 7.34   di 0 2 2 6 6.67
 * With the Outlast's: ann 7 11 13.67 15.67 17.67, bo 5 6 9.67 10.67 14.34, cy 6 10 12.67 15.67 17.34, di 4 8 10 16 17.67.
 */
const SAID = {
  boot: { 1: { ann: "c8", bo: "c9", cy: "c8" }, 2: { ann: "c3", di: "c3" }, 3: { bo: "c9" }, 4: { ann: "c0", cy: "c5", di: "c5" }, 5: { bo: "c7", cy: "c6" } },
  pot: { 1: { ann: "c0", bo: "c0", di: "c1" }, 2: { cy: "c4" }, 3: { ann: "c0", bo: "c0", cy: "c0" }, 4: { di: "c6", ann: "c4" }, 5: { bo: "c2", cy: "c2", di: "c2" } },
};
const QUESTIONS = { ann: [3, 5, 5.67, 5.67, 5.67], bo: [1, 1, 3.67, 3.67, 6.34], cy: [2, 4, 4.67, 6.67, 7.34], di: [0, 2, 2, 6, 6.67] };
const OUTLAST = { ann: [4, 6, 8, 10, 12], bo: [4, 5, 6, 7, 8], cy: [4, 6, 8, 9, 10], di: [4, 6, 8, 10, 11] };
/** The copy as the server hands it to the engine: the draft's own questions graded on it, carried (answer-points.ts walked). */
const lined = (s, rows) => S.AnswerLogic.withLines(s, S.AnswerLogic.lines(s, rows, S.AnswerLogic.facts(s)));
const table = (v) => S.computeScores(v).map((r) => [r.playerId, r.locked, r.questions, r.total]);

test("a draft's own questions: their shape, settings, words and what's still refused", () => {
  const spec = outlast([...FINALE, BOOT, POT]);
  assert.deepEqual(G.specProblems(spec, CTX), []);
  assert.deepEqual(G.specWaitsFor(spec), []);
  assert.equal(G.typeOf(spec), "classic-draft");
  assert.equal(G.typeOf({ ...spec, preset: "weekly-lineup", count: { start: 1 }, score: { by: "moments", points: null } }), "active-roster");
  // Its finale predictions first, as Start a game makes them, its own after: their own field.
  const full = G.fullSpec(spec);
  assert.deepEqual(G.finaleIn(full.ask), { top3: 1, winner: 3, from: "any" });
  assert.deepEqual(G.draftQuestions(full).map((q) => q.id), ["boot", "pot"]);
  assert.equal(G.flagsOf(full).hasDraftQuestions, true);
  assert.equal(G.flagsOf(G.fullSpec(outlast(FINALE))).hasDraftQuestions, false, "finale predictions alone are no sheet of its own");
  const st = G.settingsOf(spec);
  assert.deepEqual([st.finalePredictionsEnabled, st.draftQuestions.map((q) => q.id), st.questions], [true, ["boot", "pot"], undefined]);
  assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...st }), full), "back from its settings");
  // A game of questions' questions left behind in settings.questions are never a draft's (its own field).
  assert.deepEqual(G.specOf({ ...st, draftQuestions: undefined, questions: [BOOT] }).ask.map((q) => q.id), ["top3", "winner"]);
  // Taken away again: back to the Outlast's own.
  const back = G.withSpec(G.withSpec(G.settingsOf(G.PRESETS.outlast), spec), G.PRESETS.outlast);
  assert.equal(back.draftQuestions, undefined);
  assert.ok(G.sameValue(G.specOf(back), G.fullSpec(G.PRESETS.outlast)));
  // Its words: the sentence asks them beside the team; How it works says each and that their points add to your team's.
  const d = G.describeSpec(outlast([BOOT]), { show: "Survivor 51" });
  assert.equal(d.name, "Outlast");
  assert.equal(d.sentence, "An Outlast for Survivor 51: everyone drafts 2, and answers one question before each episode: who goes home, all season. Each scores by how long they last: the last one standing carries you. 2 points for each right answer.");
  assert.ok(d.rules.includes("Answer one question too, their points added to your team's:"));
  assert.ok(d.rules.includes("Before each episode: Who goes home? 2 points if you're right."));
  // From your own team: a draft has teams (a game of questions doesn't); the bot's call and the answer most of you give too.
  for (const q of [{ ...BOOT, from: "team" }, { ...BOOT, beat: { by: "bot" } }, { ...BOOT, settle: { by: "players", take: "majority" } }]) {
    assert.deepEqual(G.specProblems(outlast([q]), CTX), [], JSON.stringify(q));
    assert.equal(G.typeOf(outlast([q])), "classic-draft");
  }
  // Still refused: any of your points staked (money, C6); beside its cuts or a race (who's out decides the moves the league's own
  // writes take, and those read it as stored, without the questions' points); the answer most of you give to a finale prediction
  // (those answers are the state's); questions beside a stock market ranked by worth; the show's calls (a game of their own); a late
  // lock.
  const waits = (s) => G.specWaitsFor(s).map((w) => w.at);
  assert.deepEqual(waits(outlast([{ ...BOOT, wager: "total" }])), ["ask[0].wager"]);
  assert.deepEqual(waits(outlast([BOOT, { ...BOOT, id: "bet", wager: 3 }])), [], "a fixed stake is your own");
  for (const rank of [{ by: "standing", cut: [{ at: { every: 1 }, out: 1 }] }, { by: "total", race: { to: 30 } }, { by: "standing", cut: [{ at: { episode: 3 } }], teams: { of: 2 } }]) {
    assert.deepEqual(G.specWaitsFor(outlast([BOOT], rank)).map((w) => [w.at, /beside its cuts or a race/.test(w.problem)]), [["ask", true]], JSON.stringify(rank));
  }
  assert.deepEqual(waits(outlast([...FINALE, { ...BOOT, id: "most", answer: "person", asked: "once", closes: "finale", settle: { by: "players", take: "majority", of: "winner" } }])), ["ask[2].settle.of"]);
  assert.deepEqual(waits(outlast([...FINALE, ...Array.from({ length: 11 }, (_, i) => ({ ...BOOT, id: `b${i}` }))])), ["ask"], "twelve questions a game, its finale predictions among them");
  assert.deepEqual(ats(G.specProblems(outlast([G.CALLS]), CTX)), ["ask[0]"]);
  assert.deepEqual(ats(G.specProblems({ ...outlast([BOOT]), extras: { lateLock: { hours: 12 } } }, CTX)), ["extras.lateLock"]);
  // A pool's picks, a bingo card: still a stage alongside.
  assert.deepEqual(waits({ preset: "survival-pool", ask: [BOOT] }), ["ask"]);
});

test("the questions' lines: graded through each episode and now, a line of the draft's table and series; nothing without them", () => {
  const s = league(outlast([BOOT, POT]));
  const rows = rowsOf(SAID);
  const L = S.AnswerLogic.lines(s, rows, S.AnswerLogic.facts(s));
  for (const p of SEATS) {
    assert.deepEqual([1, 2, 3, 4, 5].map((k) => L.through[k][p] || 0), QUESTIONS[p], p);
    assert.equal(L.now[p], QUESTIONS[p][4]);
  }
  const v = S.AnswerLogic.withLines(s, L);
  // The table: the Outlast's places, the questions beside them, the total rounded (the pot's shares are cents).
  assert.deepEqual(table(v), [["ann", 12, 5.67, 17.67], ["di", 11, 6.67, 17.67], ["cy", 10, 7.34, 17.34], ["bo", 8, 6.34, 14.34]]);
  assert.deepEqual(Object.keys(S.computeScores(v)[0]).slice(0, 9), ["playerId", "name", "color", "locked", "banked", "bonus", "finale", "questions", "total"]);
  // The series: each episode's totals with them, each row's parts.
  const series = S.KnockoutLogic.series(v);
  for (const p of SEATS) assert.deepEqual(series.map((x) => x.totals.get(p)), OUTLAST[p].map((n, i) => Math.round((n + QUESTIONS[p][i]) * 100) / 100), p);
  assert.deepEqual(series[2].rows.get("bo"), { locked: 6, banked: 2, bonus: 0, finale: 0, questions: 3.67 });
  // Without the server's lines (a reader not taught yet), the questions score nothing: the Outlast as it was.
  assert.deepEqual(table(s).map(([p, l, q, t]) => [p, l, q, t]), [["ann", 12, 0, 12], ["di", 11, 0, 11], ["cy", 10, 0, 10], ["bo", 8, 0, 8]]);
  // A copy that hides anything drops them (it's that copy's to work out again); a game's end keeps them (spanView).
  assert.equal(S.GhostLogic.viewFor(v, "bo", 3).answerLines, undefined);
  assert.equal(S.GhostLogic.viewFor(v, "bo", null).answerLines, L);
  // Only the draft's own questions count: a finale prediction's id in game_answers is nobody's line (finale predictions are the
  // state's), and an answer to a question it doesn't ask earns nothing.
  const fin = league(outlast([...FINALE, BOOT]));
  const extra = [{ playerId: "ann", question: "winner", episode: 0, answer: "c0" }, { playerId: "bo", question: "nope", episode: 1, answer: "c8" }];
  assert.deepEqual(S.AnswerLogic.lines(fin, [...rowsOf({ boot: SAID.boot }), ...extra], S.AnswerLogic.facts(fin)).now, { ann: 4, cy: 4, di: 4, bo: 4 });
  // A lineup (best ball, every moment at the show's points: a win 1.1 here) rounds as it always has: its team's points as before, the
  // questions' cents beside them (the pot alone: ann 1 + 0.67, bo 1 + 0.67 + 0.67, cy 2 + 0.67 + 0.67, di 2 + 0.67), its total rounded.
  const lu = league({ ...outlast([POT]), preset: "weekly-lineup", count: { best: 2 }, score: { by: "moments", points: { individualImmunity: 1 } } });
  const lv = lined(lu, rowsOf({ pot: SAID.pot }));
  const before = new Map(S.computeScores(lu).map((x) => [x.playerId, x.locked]));
  for (const x of S.computeScores(lv)) {
    assert.equal(x.locked, before.get(x.playerId), x.playerId);
    assert.equal(x.questions, { ann: 1.67, bo: 2.34, cy: 3.34, di: 2.67 }[x.playerId]);
    assert.equal(x.total, Math.round((x.locked + x.questions) * 100) / 100);
  }
});

test("head to head, its final and teams of players play on a draft's questions' points", () => {
  // Head to head with a final at Episode 5 between the top two (the regular season 1 to 4): the questions about the whole game settle
  // at the final, as a game of questions' do there. Idols played through 5: Episodes 2, 3 and 5, three; bo's 3 exactly right (4
  // points), ann's 2 not. Through 4 it waits (nothing for it); at 5 the series and the table both count it.
  const hf = league(outlast([BOOT, POT, IDOLS], { by: "matchups", playoffs: { teams: 2, from: 5 } }));
  const said = [...rowsOf(SAID), ...rowsOf({ idols: { 0: { ann: 2, bo: 3 } } })];
  const L = S.AnswerLogic.lines(hf, said, S.AnswerLogic.facts(hf));
  assert.deepEqual([L.through[4].bo, L.through[5].bo, L.now.bo, L.through[5].ann], [3.67, 10.34, 10.34, 5.67]);
  const fv = S.AnswerLogic.withLines(hf, L);
  assert.deepEqual([S.lastEpisode(fv), S.gameOver(fv)], [5, true]);
  const last = S.KnockoutLogic.series(fv).pop();
  for (const r of S.computeScores(fv)) assert.equal(r.total, last.totals.get(r.playerId), `${r.playerId}: the table is the series at the final`);
  // Head to head, Episode 1's round (ann v di, bo v cy) on what each scored in it: ann 7 to di's 4, cy 6 to bo's 5.
  const h = lined(league(outlast([BOOT, POT], { by: "matchups" })), rowsOf(SAID));
  const week1 = S.MatchupLogic.run(h).weeks[0].games.map((g) => [g.a, g.aPoints, g.b, g.bPoints, g.result]);
  assert.deepEqual(week1, [["ann", 7, "di", 4, "a"], ["bo", 5, "cy", 6, "b"]]);
  // Teams of players (ann and bo, cy and di), summed: 17.67 + 14.34 and 17.34 + 17.67.
  const t = lined(league(outlast([BOOT, POT], { by: "total", teams: { of: 2, made: "choose", score: "sum" } }), { teams: true }), rowsOf(SAID));
  assert.deepEqual(S.computeScores(t).map((x) => [x.playerId, x.team.id, x.team.points]), [["di", "t2", 35.01], ["cy", "t2", 35.01], ["ann", "t1", 32.01], ["bo", "t1", 32.01]]);
});
