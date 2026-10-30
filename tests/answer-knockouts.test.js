// A game of questions' race and knockouts (docs/PLAN-start-a-game-gpt.md step A11 part 2b: the stretch request s48 "Guess every
// elimination winner; a wrong guess knocks you out" on The Challenge): lives on its answers (score.lives: a wrong answer, or none,
// to a question score.livesOn names, else every one asked each episode about it alone, costs one; at none you're out), a race and
// cuts on its answers' points (rank.race, rank.cut, as a draft's), last one standing and its end (rank.oneLeft, rank.allOut, their
// defaults ANSWERS_END). Their shape, defaults, words and settings; the walk over graded answers (AnswerLogic.walk: answers and
// facts as AnswerLogic.grade takes them) and what reads it once a copy of the league carries it (lastEpisode, gameOver, spanView,
// the scores' `out` and rank, someone's answers after they went out counting for nobody, a copy that hides anything dropping it);
// each fallback (a night that doesn't count, a verdict still waiting, a corrected result, a tie, everyone out the same night, late
// joiners); the Games tab's table ranking last one standing. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const A = S.AnswerLogic;
const ats = (problems) => problems.map((p) => p.at);

/** Survivor's rules as the data rule sees them: research's moments, who goes home, a winner, two phases. */
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "idolPlayed", label: "Played an idol", defaultPoints: 1, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  calls: "results",
  roles: [],
  grouped: true,
  phases: [{ id: "tribes", name: "Tribes" }, { id: "merged", name: "Merged" }],
};
/** The Challenge's, for s48: who won the elimination is research's. */
const CHALLENGE = { ...CTX, moments: [{ id: "eliminationWin", label: "Won an elimination", defaultPoints: 3, answeredBy: "research" }] };

const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const IMMUNE = { id: "immune", ask: "Who wins immunity?", answer: "person", points: 2, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const IDOL = { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
const WINNER = { id: "winner", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } };
const GONE = { id: "gone", ask: "Who'll be gone in the next two?", answer: "person", points: 2, asked: "every", every: 2, settle: { by: "results", take: "out" } };
const S48 = { get: { by: "none" }, score: { by: "answers", lives: 1 }, rank: { by: "standing" }, ask: [{ id: "elimination", ask: "Who wins the elimination?", answer: "person", points: 1, asked: "each", settle: { by: "moment", moment: "eliminationWin", take: "who" } }] };
/** A game of questions asking `ask`, scored and ranked as said. */
const game = (ask, score = {}, rank) => ({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers", ...score }, ask, ...(rank ? { rank } : {}) });

/** A game of questions on Survivor (or `show`) with `n` castaways and players (ann, bo, cy by default). */
function league(spec, players = ["ann", "bo", "cy"], n = 10, show = "survivor", ctx = CTX) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", show);
  // The Challenge's built-in rules (who won the elimination is one of its moments).
  if (show === "the-challenge") s.settings.showFormat = "challenge";
  S.updateSettings(s, "leagueTypeId", "questions");
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < n; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx }), []);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => S.ensureEpisodeNumber(s, n, false);
/** Who went home in episode n (castaway indexes) and what happened in it ([moment, castaway index]); none of either, a quiet night. */
function results(s, n, outs, events = []) {
  const e = ep(s, n);
  for (const i of outs) S.addElimination(s, e.id, cid(s, i), "Voted Out");
  for (const [type, i] of events) S.addScoringEvent(s, e.id, type, cid(s, i));
  if (!outs.length && !events.length) S.EpisodeLogic.setNoExit(s, e.id, true);
  return e;
}
/** Answers to one question at an episode: { player: castaway index | answer }. */
const said = (s, question, n, by) =>
  Object.entries(by).map(([playerId, a]) => ({ playerId, question, episode: n, answer: Number.isInteger(a) ? cid(s, a) : a }));
/** The walk on the state as it is, and the state carrying it. */
const walked = (s, rows) => {
  const w = A.walk(s, rows, A.facts(s));
  return { w, v: A.withWalk(s, w) };
};
/** Each one's score row in the table's order: [playerId, total, out]. */
const table = (v) => S.computeScores(v).map((r) => [r.playerId, r.total, r.out]);

test("lives, a race and cuts on a game of questions: their shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  // s48 on The Challenge's rules: one life on its one question, last one standing.
  assert.deepEqual(at(S48, CHALLENGE), []);
  assert.equal(G.typeOf(S48), "questions");
  assert.deepEqual(G.specWaitsFor(S48), []);
  assert.deepEqual(G.answerParts(G.fullSpec(S48)), { race: null, cuts: [], lives: 1, on: ["elimination"], oneLeft: "ends", allOut: "points" });
  // Lives say last one standing by themselves (fullSpec), and their ends' defaults are read, never filled in.
  assert.deepEqual(G.fullSpec(game([BOOT], { lives: 2 })).rank, { by: "standing" });
  assert.deepEqual(G.fullSpec(game([BOOT], { lives: 2 }, { allOut: "share" })).rank, { allOut: "share", by: "standing" });
  // Every question asked each episode about it alone, unless livesOn names them.
  assert.deepEqual(G.answerParts(G.fullSpec(game([BOOT, IMMUNE, WINNER, GONE, { ...IDOL, over: 3 }], { lives: 1 }))).on, ["boot", "immune"]);
  assert.deepEqual(G.answerParts(G.fullSpec(game([BOOT, IMMUNE], { lives: 1, livesOn: ["immune"] }))).on, ["immune"]);
  // A race alone ranks by the total; cuts rank last one standing, as a draft's.
  assert.deepEqual(G.answerParts(G.fullSpec(game([BOOT], {}, { by: "total", race: { to: 5 } }))), { race: { to: 5 }, cuts: [], lives: null, on: [], oneLeft: null, allOut: null });
  const cut = G.fullSpec(game([BOOT], {}, { cut: [{ at: { every: 2 } }] }));
  assert.deepEqual(cut.rank, { cut: [{ at: { every: 2 }, out: 1, tie: "keep", quiet: "cut" }], by: "standing" });
  assert.equal(G.answerParts(cut).oneLeft, "ends");
  assert.equal(G.answerParts(cut).allOut, null, "a cut never takes everyone");
  assert.equal(G.answerParts(G.fullSpec(game([BOOT]))), null, "a game of questions with none of them, as before");
  assert.equal(G.answerParts(G.fullSpec(G.PRESETS["weekly-calls"])), null);
  // Flags.
  const flags = G.flagsOf(G.fullSpec(S48));
  assert.deepEqual([flags.hasAnswerLives, flags.hasRace, flags.hasCuts, flags.hasQuestions], [true, false, false, true]);
  // Words.
  const d = G.describeSpec(S48, { show: "The Challenge 42" });
  assert.match(d.sentence, /One life: a wrong answer, or none, costs one\. Last one standing wins\./);
  assert.ok(d.rules.some((r) => /You have one life: a wrong answer to a question asked each episode, or none, costs one once it's settled\. At none you're out\./.test(r)));
  assert.ok(d.rules.some((r) => /Once one of you is left, or none, it's over\./.test(r)));
  assert.ok(!d.rules.includes("Most points wins."));
  assert.match(G.describeSpec(game([BOOT, IMMUNE], { lives: 2, livesOn: ["immune"] })).sentence, /Two lives: a wrong answer to "Who wins immunity\?", or none, costs one\./);
  assert.match(G.describeSpec(game([BOOT], {}, { by: "total", race: { to: 5 } })).sentence, /First to 5 points wins: the game ends there\./);
  assert.match(G.describeSpec(game([BOOT], { lives: 1 }, { by: "standing", allOut: "back", oneLeft: "plays" })).sentence, /With one of you left it plays on\. If everyone left goes out together, they're all back in\./);
  // The settings, both ways (none written for a game of questions without them).
  const spec = game([BOOT, IMMUNE], { lives: 2, livesOn: ["boot"] }, { by: "standing", allOut: "share", race: { to: 9 }, cut: [{ at: { episode: 4 }, out: "half" }] });
  const fields = G.settingsOf(spec);
  assert.deepEqual(
    [fields.questionsLives, fields.questionsLivesOn, fields.questionsRace, fields.questionsCut, fields.rankAllOut],
    [2, ["boot"], { to: 9 }, [{ at: { episode: 4 }, out: "half", tie: "keep", quiet: "cut" }], "share"]
  );
  assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...fields }), G.fullSpec(spec)), "reads back as the spec it wrote");
  const plain = G.settingsOf(game([BOOT]));
  assert.deepEqual([plain.questionsLives, plain.questionsCut, plain.rankAllOut], [undefined, undefined, undefined]);
  // Lives alone read back as last one standing: it's the only way a game that knocks players out ranks.
  assert.equal(G.specOf({ ...S.defaultState().settings, ...G.settingsOf(game([BOOT], { lives: 1 })) }).rank.by, "standing");
  // Refused.
  assert.deepEqual(at(game([BOOT], { lives: 0 })), ["score.lives"]);
  assert.deepEqual(at(game([BOOT], { lives: 6 })), ["score.lives"]);
  assert.deepEqual(at(game([BOOT], { lives: 1 }, { by: "total" })), ["rank.by"], "a game that knocks players out ranks last one standing");
  assert.deepEqual(at(game([WINNER], { lives: 1 })), ["score.lives"], "nothing asked each episode to ride on");
  assert.deepEqual(at(game([BOOT, GONE], { lives: 1, livesOn: ["gone"] })), ["score.livesOn[0]"], "asked every two: not one episode's");
  assert.deepEqual(at(game([BOOT], { lives: 1, livesOn: ["nope"] })), ["score.livesOn[0]"]);
  assert.deepEqual(at(game([BOOT], { lives: 1, livesOn: ["boot", "boot"] })), ["score.livesOn[1]"]);
  assert.deepEqual(at(game([BOOT], { livesOn: ["boot"] })), ["score.livesOn"], "which questions is for a game with lives");
  assert.deepEqual(at(game([BOOT], {}, { by: "standing" })), ["rank.by"], "nobody's out of a game that knocks nobody out");
  assert.deepEqual(at(game([BOOT], {}, { by: "standing", cut: [{ at: { every: 1 } }], allOut: "back" })), ["rank.allOut"]);
  assert.deepEqual(at(game([BOOT], { lives: 1, misses: 1 })), ["score.misses"], "a misspelled key is reported");
  assert.deepEqual(at({ ...G.PRESETS["weekly-calls"], score: { by: "answers", lives: 1 } }), ["score.lives"], "Weekly Calls' calls are the couch's");
  assert.deepEqual(at({ ...G.PRESETS["weekly-calls"], rank: { by: "total", race: { to: 5 } } }), ["rank.race"]);
});

test("one life: a wrong answer, or none, knocks you out; the last one standing ends it, points frozen where each went out", () => {
  const s = league(game([BOOT], { lives: 1 }));
  results(s, 1, [0]);
  results(s, 2, [1]);
  results(s, 3, [2]);
  const rows = [
    ...said(s, "boot", 1, { ann: 0, bo: 0, cy: 5 }),
    // bo answers nothing in Episode 2: a missed answer costs a life, as a missed pick does.
    ...said(s, "boot", 2, { ann: 1, cy: 1 }),
    ...said(s, "boot", 3, { ann: 2 }),
  ];
  const { w, v } = walked(s, rows);
  // cy wrong at 1, bo silent at 2: ann the last one standing, over at 2 (her right answer at 3 counts for nothing).
  assert.deepEqual(w.out, { cy: 1, bo: 2 });
  assert.equal(w.ends, 2);
  assert.deepEqual(w.lives, { ann: 1, bo: 0, cy: 0 });
  assert.deepEqual(w.totals, { ann: 2, bo: 1, cy: 0 });
  assert.equal(S.lastEpisode(v), 2);
  assert.equal(S.gameOver(v), true);
  assert.equal(S.gameOver(s), false, "a state without its walk plays on to its span's end");
  assert.equal(S.endEpisode(v), null, "the span stays as made");
  // Last one standing: ann (still in), then bo (out last), then cy; each one's points frozen where they went out.
  assert.deepEqual(table(v), [["ann", 2, null], ["bo", 1, 2], ["cy", 0, 1]]);
  assert.equal(S.KnockoutLogic.isOut(v, "bo"), true);
  assert.equal(S.KnockoutLogic.isOut(v, "ann"), false);
  assert.equal(S.KnockoutLogic.endedBefore(v, 3), true);
  // Results past the end are cut away (spanView), and the copy keeps the walk.
  const view = S.spanView(v);
  assert.notEqual(view, v);
  assert.deepEqual(view.answerWalk, v.answerWalk);
  assert.equal(S.gameOver(view), true);
  assert.deepEqual(table(view), [["ann", 2, null], ["bo", 1, 2], ["cy", 0, 1]]);
  // Two lives: one wrong costs one, and the second goes out.
  const two = league(game([BOOT], { lives: 2 }));
  results(two, 1, [0]);
  results(two, 2, [1]);
  const tw = walked(two, [...said(two, "boot", 1, { ann: 0, bo: 5, cy: 5 }), ...said(two, "boot", 2, { ann: 1, bo: 1, cy: 6 })]).w;
  assert.deepEqual(tw.out, { cy: 2 });
  assert.deepEqual(tw.lives, { ann: 2, bo: 1, cy: 0 });
  assert.equal(tw.ends, null);
});

test("each fallback: a quiet night, an answer still to settle, an earlier episode left early, a void, a corrected result", () => {
  const s = league(game([BOOT, IMMUNE], { lives: 1 }));
  // Episode 1: nobody went home (quiet): the boot question doesn't count, so nobody loses a life on it; immunity counts.
  results(s, 1, [], [["individualImmunity", 4]]);
  const rows1 = [...said(s, "boot", 1, { ann: 0, bo: 1 }), ...said(s, "immune", 1, { ann: 4, bo: 4, cy: 4 })];
  assert.deepEqual(walked(s, rows1).w.out, {}, "a quiet night costs nobody a life, answered or not");
  // Episode 2's early results (who went home, not yet the moments): immunity is still to settle there, so the walk waits.
  const e2 = results(s, 2, [1]);
  S.EpisodeLogic.setResultsStage(s, e2.id, "early");
  const rows2 = [...rows1, ...said(s, "boot", 2, { ann: 1, bo: 2, cy: 1 }), ...said(s, "immune", 2, { ann: 5, bo: 5, cy: 5 })];
  assert.deepEqual(walked(s, rows2).w.out, {}, "bo's wrong boot waits for the episode's full results");
  assert.equal(walked(s, rows2).w.ends, null);
  // Episode 3 in: Episode 2 stays early (nothing scored marked it final), so its immunity never settles and costs nothing; its boot
  // counts (bo wrong: out at 2).
  results(s, 3, [2], [["individualImmunity", 5]]);
  const rows3 = [...rows2, ...said(s, "boot", 3, { ann: 2, cy: 3 }), ...said(s, "immune", 3, { ann: 5, cy: 6 })];
  const third = walked(s, rows3);
  assert.deepEqual(third.w.out, { bo: 2, cy: 3 });
  assert.equal(third.w.ends, 3, "ann the last one standing");
  // A corrected result works it out again: Episode 3's immunity was castaway 6's, so ann was wrong too, with cy (wrong on the
  // boot): the two left out the same night, by their points.
  const e3 = ep(s, 3);
  S.removeScoringEvent(s, e3.id, e3.scoringEvents.find((x) => x.type === "individualImmunity").id);
  S.addScoringEvent(s, e3.id, "individualImmunity", cid(s, 6));
  const again = walked(s, rows3);
  assert.deepEqual(again.w.out, { bo: 2, ann: 3, cy: 3 });
  assert.equal(again.w.ends, 3, "none left");
  assert.deepEqual(table(again.v).map((r) => r[0]), ["cy", "ann", "bo"], "cy's immunity at 3 puts her ahead of ann");
  // A void pick (F3 part 2: a pair that didn't play the episode as offered) is neither right nor wrong: it costs nothing.
  const PAIR = { id: "pair", ask: "Which pair loses someone?", answer: "group", points: 1, asked: "each", settle: { by: "results", take: "out" } };
  const p = league(game([PAIR], { lives: 1 }));
  results(p, 1, [0]);
  const fg = {
    offered: [{ id: "g1", name: "A & B", members: [cid(p, 0), cid(p, 1)] }, { id: "g2", name: "C & D", members: [cid(p, 2), cid(p, 3)] }, { id: "g3", name: "E & F", members: [cid(p, 4), cid(p, 5)] }],
    byCastaway: new Map([[cid(p, 0), "g1"], [cid(p, 1), "g1"], [cid(p, 2), "g2"], [cid(p, 3), "g2"], [cid(p, 4), "g3"], [cid(p, 5), "g3"]]),
    lockSure: true,
    played: { sure: true, held: new Set(["g1", "g2"]) },
  };
  const pw = A.walk(p, said(p, "pair", 1, { ann: "g1", bo: "g2", cy: "g3" }), { ...A.facts(p), formatGroups: new Map([[1, fg]]) });
  assert.deepEqual(pw.out, { bo: 1 }, "cy's pair re-drawn at the start: void, no life lost");
});

test("more lives, each wrong answer its own; everyone left out the same night: by points, sharing it, or all back", () => {
  // Two lives, two questions a night: two wrong answers in one night cost both.
  const s = league(game([BOOT, IMMUNE], { lives: 2 }));
  results(s, 1, [0], [["individualImmunity", 4]]);
  const w1 = walked(s, [...said(s, "boot", 1, { ann: 0, bo: 1, cy: 0 }), ...said(s, "immune", 1, { ann: 4, bo: 5, cy: 5 })]).w;
  assert.deepEqual(w1.out, { bo: 1 });
  assert.deepEqual(w1.lives, { ann: 2, bo: 0, cy: 1 });
  // One life, three left, all wrong in Episode 1: by default they're all out, ranked by their points (a tie shares it); it's over.
  const everyone = (rank) => {
    const x = league(game([BOOT, IMMUNE], { lives: 1, livesOn: ["boot"] }, rank));
    results(x, 1, [0], [["individualImmunity", 4]]);
    results(x, 2, [1]);
    const rows = [...said(x, "boot", 1, { ann: 5, bo: 5, cy: 6 }), ...said(x, "immune", 1, { ann: 4, bo: 4 })];
    return { x, ...walked(x, rows) };
  };
  const pts = everyone();
  assert.deepEqual(pts.w.out, { ann: 1, bo: 1, cy: 1 });
  assert.equal(pts.w.ends, 1, "none left: over");
  assert.deepEqual(S.computeScores(pts.v).map((r) => [r.playerId, r.total]), [["ann", 2], ["bo", 2], ["cy", 0]]);
  // Sharing it: all tied, whatever their points.
  const share = everyone({ by: "standing", allOut: "share" });
  assert.deepEqual(share.w.shared.sort(), ["ann", "bo", "cy"]);
  const keys = S.computeScores(share.v).map((r) => S.rankKey(share.v, r).join(","));
  assert.equal(new Set(keys).size, 1, "everyone tied");
  // All back, with the lives they had: nobody's out, and the game goes on.
  const back = everyone({ by: "standing", allOut: "back" });
  assert.deepEqual(back.w.out, {});
  assert.deepEqual(back.w.lives, { ann: 1, bo: 1, cy: 1 });
  assert.equal(back.w.ends, null);
  // A lone survivor going out is just going out, never spared (two or more left for an everyone-out night).
  const lone = league(game([BOOT], { lives: 1 }, { by: "standing", allOut: "back", oneLeft: "plays" }));
  results(lone, 1, [0]);
  results(lone, 2, [1]);
  results(lone, 3, [2]);
  const l = walked(lone, [...said(lone, "boot", 1, { ann: 0, bo: 0, cy: 3 }), ...said(lone, "boot", 2, { ann: 1, bo: 4 }), ...said(lone, "boot", 3, { ann: 9 })]).w;
  assert.deepEqual(l.out, { cy: 1, bo: 2, ann: 3 });
  // Two left and both wrong, all back: nobody goes.
  const pair = league(game([BOOT], { lives: 1 }, { by: "standing", allOut: "back" }));
  results(pair, 1, [0]);
  results(pair, 2, [1]);
  assert.deepEqual(walked(pair, [...said(pair, "boot", 1, { ann: 0, bo: 0, cy: 3 }), ...said(pair, "boot", 2, { ann: 9 })]).w.out, { cy: 1 });
});

test("one left playing on; the field: a ghost outside, someone catching up immune, a late start from their start", () => {
  const plays = league(game([BOOT], { lives: 1 }, { by: "standing", oneLeft: "plays" }));
  results(plays, 1, [0]);
  results(plays, 2, [1]);
  const p = walked(plays, [...said(plays, "boot", 1, { ann: 0, bo: 0, cy: 3 }), ...said(plays, "boot", 2, { ann: 1, bo: 4 })]);
  assert.deepEqual(p.w.out, { cy: 1, bo: 2 });
  assert.equal(p.w.ends, null, "ann alone plays on");
  assert.equal(S.gameOver(p.v), false);
  assert.deepEqual(p.w.totals, { ann: 2, bo: 1, cy: 0 });
  // A ghost (a late joiner's private season) is outside it; someone catching up is in it, loses no life until caught up, and holds
  // the end off; a late start counts from their start.
  const s = league(game([BOOT], { lives: 1 }), ["ann", "bo", "cy", "gh", "di", "eve"]);
  s.players.find((x) => x.id === "gh").ghost = true;
  s.players.find((x) => x.id === "di").lateJoin = { startEpisode: 1, catchingUp: true };
  s.players.find((x) => x.id === "eve").lateJoin = { startEpisode: 3, catchingUp: false };
  results(s, 1, [0]);
  results(s, 2, [1]);
  const w = walked(s, [...said(s, "boot", 1, { ann: 0, bo: 0 }), ...said(s, "boot", 2, { ann: 1, bo: 5 })]).w;
  assert.deepEqual(w.out, { cy: 1, bo: 2 }, "gh, di and eve lose nothing");
  assert.equal(w.ends, null, "ann, di and eve are still in");
  assert.deepEqual(Object.keys(w.lives).sort(), ["ann", "bo", "cy", "di", "eve"]);
});

test("a race and cuts on the answers' points: the first there ends it; the lowest over each window out, ties to the total", () => {
  const race = league(game([BOOT, IMMUNE], {}, { by: "total", race: { to: 4 } }));
  results(race, 1, [0], [["individualImmunity", 4]]);
  results(race, 2, [1], [["individualImmunity", 5]]);
  results(race, 3, [2], [["individualImmunity", 6]]);
  const rows = [...said(race, "immune", 1, { ann: 4, bo: 4 }), ...said(race, "boot", 1, { bo: 0 }), ...said(race, "immune", 2, { ann: 5, cy: 5 }), ...said(race, "immune", 3, { bo: 6, cy: 6 })];
  const r = walked(race, rows);
  // Through 1: ann 2, bo 3; through 2: ann 4 (there), bo 3, cy 2: it ends at 2, the most points then winning.
  assert.equal(r.w.ends, 2);
  assert.deepEqual(r.w.out, {});
  assert.deepEqual(table(r.v), [["ann", 4, null], ["bo", 3, null], ["cy", 2, null]]);
  // Through Episode 1 nobody is there: it plays on.
  assert.equal(walked(race, rows.filter((x) => x.episode === 1)).w.ends, null);
  // The guillotine every two episodes: the lowest over them goes, a tie at the line to the total; one left ends it.
  const cut = league(game([BOOT], {}, { cut: [{ at: { every: 2 } }] }), ["ann", "bo", "cy"]);
  results(cut, 1, [0]);
  results(cut, 2, [1]);
  results(cut, 3, [2]);
  results(cut, 4, [3]);
  const c = walked(cut, [...said(cut, "boot", 1, { ann: 0, bo: 0 }), ...said(cut, "boot", 2, { ann: 1, cy: 1 }), ...said(cut, "boot", 3, { ann: 2, bo: 2 }), ...said(cut, "boot", 4, { bo: 3 })]);
  // Over 1-2: ann 2, bo 1, cy 1 (a tie at the line, and on the total: nobody goes); over 3-4: ann 1, bo 2, cy 0: cy goes.
  assert.deepEqual(c.w.out, { cy: 4 });
  assert.equal(c.w.ends, null);
});

test("someone's answers after they went out count for nobody; a copy that hides anything drops the walk; a viewer behind isn't out", () => {
  // A pot split between everyone right: bo, out after Episode 1, takes no share of Episode 2's though he answered it early.
  const POT = { ...BOOT, id: "pot", points: 6, share: "split" };
  const s = league(game([POT], { lives: 1 }, { by: "standing", oneLeft: "plays" }));
  results(s, 1, [0]);
  results(s, 2, [1]);
  const rows = [...said(s, "pot", 1, { ann: 0, bo: 5, cy: 0 }), ...said(s, "pot", 2, { ann: 1, bo: 1, cy: 1 })];
  const { w, v } = walked(s, rows);
  assert.deepEqual(w.out, { bo: 1 });
  assert.deepEqual(w.totals, { ann: 6, bo: 0, cy: 6 }, "3 each at 1, 3 each at 2: bo's answer at 2 takes none");
  assert.deepEqual(A.liveAnswers(v, rows).filter((x) => x.playerId === "bo").map((x) => x.episode), [1]);
  // An answer about the whole game, or to a window still open when they went out, counts for nobody either: cy, the last one
  // standing, takes the season's pot alone though bo named the same one before he went out.
  const SEASON = { id: "season", ask: "Who goes home first?", answer: "person", points: 4, share: "split", settle: { by: "results", take: "out" } };
  const pot = league(game([BOOT, SEASON, GONE], { lives: 1, livesOn: ["boot"] }, { by: "standing", oneLeft: "plays" }));
  results(pot, 1, [0]);
  results(pot, 2, [1]);
  const potRows = [...said(pot, "boot", 1, { ann: 0, bo: 4, cy: 0 }), ...said(pot, "boot", 2, { ann: 1, cy: 1 }), ...said(pot, "season", 0, { bo: 0, cy: 0 }), ...said(pot, "gone", 1, { bo: 1, cy: 1 })];
  const pw = A.walk(pot, potRows, A.facts(pot));
  assert.deepEqual(pw.out, { bo: 1 });
  assert.deepEqual(A.liveRows(pot, potRows, pw.out).filter((x) => x.playerId === "bo").map((x) => x.question), ["boot"], "his first boot only");
  assert.equal(pw.totals.cy, 1 + 1 + 4 + 2, "two boots, the whole game's pot and Episodes 1-2's run, alone");
  // A viewer who has seen only Episode 1: their copy drops the walk (worked out on more than it holds), and walked again, the same.
  const seen1 = S.GhostLogic.viewFor(v, "ann", 1);
  assert.equal(seen1.answerWalk, undefined);
  assert.deepEqual(A.walk(seen1, rows, A.facts(seen1)).out, { bo: 1 });
  // One who has seen nothing: nobody's out yet for them.
  const seen0 = S.GhostLogic.viewFor(v, "ann", 0);
  assert.deepEqual(A.walk(seen0, rows, A.facts(seen0)).out, {});
  // Nothing hidden: the same copy, walk and all.
  assert.equal(S.GhostLogic.viewFor(v, "ann", null).answerWalk, v.answerWalk);
  // The walk is never on the state itself, and a JSON copy for saving would carry nothing new (withWalk makes a copy).
  assert.equal(s.answerWalk, undefined);
});

test("the Games tab's table ranks last one standing from the walk it's handed; s48 on The Challenge's rules plays", () => {
  const GV = jiti("../src/lib/game/game-view.ts");
  const s = league(game([BOOT], { lives: 1 }));
  results(s, 1, [0]);
  results(s, 2, [1]);
  const rows = [...said(s, "boot", 1, { ann: 0, bo: 3, cy: 0 }), ...said(s, "boot", 2, { ann: 1, cy: 4 })];
  const w = A.walk(s, rows, A.facts(s));
  const right = (p) => w.totals[p] ?? 0;
  const view = GV.gameView({ leagueId: "l", name: "g", gameType: "questions", gameName: "Q", yourRole: "player" }, A.withWalk(s, w), "cy", null, () => null, { right, move: null, walk: w });
  assert.equal(view.over, true);
  assert.deepEqual(view.table.map((r) => [r.playerId, r.rank, r.total]), [["ann", "1", 2], ["cy", "2", 1], ["bo", "3", 0]]);
  // Without its walk the table ranks by points, as a game of questions always has.
  const plain = GV.tableOf(s, "cy", () => null, right);
  assert.deepEqual(plain.map((r) => r.playerId), ["ann", "cy", "bo"]);
  // s48 on The Challenge: a wrong guess at the elimination (or none) knocks you out; a night with no elimination costs nothing.
  const c = league(S48, ["ann", "bo", "cy"], 10, "the-challenge", CHALLENGE);
  results(c, 1, [3], [["eliminationWin", 2]]);
  results(c, 2, [], []);
  const cw = A.walk(c, said(c, "elimination", 1, { ann: 2, bo: 3 }), A.facts(c));
  assert.deepEqual(cw.out, { bo: 1, cy: 1 }, "bo wrong, cy answered nothing");
  assert.equal(cw.ends, 1, "ann the last one standing");
  const quiet = league(S48, ["ann", "bo"], 10, "the-challenge", CHALLENGE);
  results(quiet, 1, [], []);
  assert.deepEqual(A.walk(quiet, said(quiet, "elimination", 1, { ann: 2 }), A.facts(quiet)).out, {}, "no elimination: nothing to be wrong about");
});
