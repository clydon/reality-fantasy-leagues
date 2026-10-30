// Co-op against the show (docs/PLAN-start-a-game-gpt.md step A11 part 3: the stretch request s37 "Co-op: together we have 5 lives;
// every faithful banished we didn't see coming costs one" on The Traitors, and the dial row win.coop): a game of questions ranked
// rank.by 'coop', whose lives (score.lives) are the couch's together, a question they ride on costing one on a night unless enough of
// the couch saw it coming (score.saves: one, most or all of those who answered; COOP's default one), the game lost by all the
// episode the last one goes and won by all at its end with one left. Its shape, defaults, words and settings; the walk over graded
// answers (AnswerLogic.walk's co-op: answers and facts as AnswerLogic.grade takes them, on a Traitors league whose roles and exits
// settle who was banished as a Faithful) and what reads it once a copy carries it (lastEpisode, gameOver, the rows' shared place);
// each fallback (a night nobody goes home, only a murder, a Traitor banished, a recruit, results still early, a corrected result,
// silence, late joiners and a ghost); the Games tab's table and the couch's standings and trophies for a game everyone wins or loses
// together. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const A = S.AnswerLogic;
const ats = (problems) => problems.map((p) => p.at);

/** The Traitors' rules as the data rule sees them: its roles, and its exits' moments (implied by the exit and the role). */
const TRAITORS_CTX = {
  moments: [
    { id: "banishedAsFaithful", label: "Banished as a Faithful", defaultPoints: -6, auto: true },
    { id: "banishedAsTraitor", label: "Banished as a Traitor", defaultPoints: -6, auto: true },
    { id: "murdered", label: "Murdered", defaultPoints: 0, auto: true },
  ],
  results: true,
  winner: true,
  roles: ["Traitor", "Faithful"],
  grouped: false,
};
/** Survivor's, for win.coop. */
const SURVIVOR_CTX = { moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true };

const BANISHED = { id: "banished", ask: "Which Faithful will be banished?", answer: "person", points: 1, asked: "each", settle: { by: "moment", moment: "banishedAsFaithful", take: "who" } };
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const WINNER = { id: "winner", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } };
/** s37 as the tracker has it. */
const S37 = { get: { by: "none" }, score: { by: "answers", lives: 5 }, rank: { by: "coop" }, ask: [BANISHED] };
/** A game of questions asking `ask`, scored and ranked as said. */
const game = (ask, score = {}, rank = { by: "coop" }, span = { from: 1, to: null }) => ({ spec: 1, span, get: { by: "none" }, score: { by: "answers", ...score }, ask, rank });

/** A co-op game on The Traitors with `n` players in its cast and the couch's `players` (ann, bo, cy by default). */
function traitors(spec, players = ["ann", "bo", "cy"], n = 10) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "the-traitors-us");
  // The Traitors' built-in rules: its roles, its exits, and what they imply (banished as a Faithful).
  s.settings.showFormat = "traitors";
  S.updateSettings(s, "leagueTypeId", "questions");
  S.updateSettings(s, "wikiSeason", 4);
  for (let i = 0; i < n; i++) S.addCastaway(s, `Player ${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: TRAITORS_CTX }), []);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => S.ensureEpisodeNumber(s, n, false);
/** Episode n's results: who was banished and who murdered (cast indexes), the Traitors named at it ([index]); none, a quiet night. */
function night(s, n, { banished = [], murdered = [], traitors = [], role = "Traitor" } = {}) {
  const e = ep(s, n);
  for (const i of traitors) S.addRole(s, e.id, cid(s, i), role);
  for (const i of murdered) S.addElimination(s, e.id, cid(s, i), "Murdered");
  for (const i of banished) S.addElimination(s, e.id, cid(s, i), "Banished");
  if (!banished.length && !murdered.length) S.EpisodeLogic.setNoExit(s, e.id, true);
  return e;
}
/** Answers to one question at an episode: { player: cast index }. */
const said = (s, question, n, by) => Object.entries(by).map(([playerId, i]) => ({ playerId, question, episode: n, answer: cid(s, i) }));
/** The walk on the state as it is, and the state carrying it. */
const walked = (s, rows) => {
  const w = A.walk(s, rows, A.facts(s));
  return { w, v: A.withWalk(s, w), c: w.coop };
};

test("co-op on a game of questions: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = TRAITORS_CTX) => ats(G.specProblems(spec, ctx));
  // s37 on The Traitors' rules: five lives, the couch's, on who's banished as a Faithful.
  assert.deepEqual(at(S37), []);
  assert.equal(G.typeOf(S37), "questions");
  assert.deepEqual(G.specWaitsFor(S37), []);
  assert.deepEqual(G.answerParts(G.fullSpec(S37)), { race: null, cuts: [], lives: 5, on: ["banished"], oneLeft: null, allOut: null, coop: { saves: "one" }, matchups: null });
  assert.deepEqual(G.fullSpec(S37).score, { by: "answers", lives: 5 }, "who saves a night is read, never filled in");
  assert.equal(G.answerParts(G.fullSpec(game([BANISHED], { lives: 2, saves: "most" }))).coop.saves, "most");
  // win.coop on Survivor: who goes home, three lives.
  assert.deepEqual(at(game([BOOT], { lives: 3 }), SURVIVOR_CTX), []);
  // Flags: co-op, its lives.
  const flags = G.flagsOf(G.fullSpec(S37));
  assert.deepEqual([flags.hasCoop, flags.hasAnswerLives, flags.hasRace, flags.hasCuts, flags.hasQuestions], [true, true, false, false, true]);
  assert.equal(G.flagsOf(G.fullSpec(game([BOOT], { lives: 1 }, { by: "standing" }))).hasCoop, false, "lives each: part 2b's");
  // Words.
  const d = G.describeSpec(S37, { show: "The Traitors (US) 5" });
  assert.match(d.sentence, /Together you have five lives: each time none of you gets it right, you lose one\. Keep one to the end and you all win\./);
  assert.ok(d.rules.some((r) => /five lives for all of you, not each\. A question asked each episode costs one once it's settled, unless one of you gets it right\./.test(r)));
  assert.ok(d.rules.some((r) => /lose the last life and you all lose, there and then; reach the end with one left and you all win\./.test(r)));
  assert.ok(!d.rules.includes("Most points wins."));
  assert.ok(!d.rules.some((r) => /Last one standing/.test(r)), "nobody is knocked out");
  assert.match(G.describeSpec(game([BANISHED], { lives: 1, saves: "most" })).sentence, /Together you have one life: each time half or more of you get it wrong, you lose one\./);
  assert.match(G.describeSpec(game([BOOT, BANISHED], { lives: 2, saves: "all", livesOn: ["banished"] })).sentence, /each time any of you gets "Which Faithful will be banished\?" wrong, you lose one\./);
  // The settings, both ways: co-op is said (questionsRank), as last one standing isn't; who saves a night only when it's said.
  const spec = game([BANISHED, BOOT], { lives: 4, livesOn: ["banished"], saves: "all" });
  const fields = G.settingsOf(spec);
  assert.deepEqual([fields.questionsLives, fields.questionsLivesOn, fields.questionsRank, fields.questionsSaves, fields.rankOneLeft, fields.rankAllOut], [4, ["banished"], "coop", "all", undefined, undefined]);
  assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...fields }), G.fullSpec(spec)), "reads back as the spec it wrote");
  const plain = G.settingsOf(S37);
  assert.deepEqual([plain.questionsRank, plain.questionsSaves], ["coop", undefined]);
  assert.equal(G.settingsOf(game([BOOT], { lives: 1 }, { by: "standing" })).questionsRank, undefined, "part 2b's lives store nothing new");
  assert.equal(G.specOf({ ...S.defaultState().settings, leagueTypeId: "questions", questions: [BOOT], questionsRank: "coop" }).rank.by, "total", "co-op without lives isn't co-op");
  // Settings that say co-op beside a cut keep the cut, so our check refuses it rather than it being lost.
  const mixed = G.specOf({ ...S.defaultState().settings, leagueTypeId: "questions", questions: [BOOT], questionsLives: 2, questionsRank: "coop", questionsCut: [{ at: { every: 2 } }] });
  assert.deepEqual([mixed.rank.by, ats(G.specProblems(mixed, SURVIVOR_CTX))], ["coop", ["rank.by"]]);
  // Refused.
  assert.deepEqual(at(game([BANISHED])), ["score.lives"], "co-op needs lives");
  assert.deepEqual(at(game([BANISHED], { lives: 6 })), ["score.lives"]);
  assert.deepEqual(at(game([WINNER], { lives: 2 })), ["score.lives"], "nothing asked each episode to ride on");
  assert.deepEqual(at(game([BANISHED], { lives: 2, saves: "some" })), ["score.saves"]);
  assert.deepEqual(at(game([BANISHED], { lives: 2, saves: "one" }, { by: "standing" })), ["score.saves"], "who saves a night is co-op's");
  assert.deepEqual(at(game([BANISHED], { lives: 2 }, { by: "coop", race: { to: 5 } })), ["rank.race"], "co-op knocks nobody out");
  assert.deepEqual(at(game([BANISHED], { lives: 2 }, { by: "coop", cut: [{ at: { every: 2 } }] })), ["rank.by"]);
  assert.deepEqual(at(game([BANISHED], { lives: 2 }, { by: "coop", oneLeft: "plays" })), ["rank.oneLeft"]);
  assert.deepEqual(at(game([BANISHED], { lives: 2 }, { by: "coop", allOut: "back" })), ["rank.allOut"]);
  assert.deepEqual(at({ preset: "survival-pool", score: { by: "survive", lives: 2 }, rank: { by: "coop" } }, SURVIVOR_CTX), ["rank.by"], "a pool's co-op isn't built");
  assert.deepEqual(at({ ...G.PRESETS["weekly-calls"], score: { by: "answers", lives: 1 }, rank: { by: "coop" } }), ["score.lives", "rank.by"], "Weekly Calls' calls are the couch's to settle");
});

test("s37: a Faithful banished whom none of you named costs the couch a life; a Traitor, a murder or a quiet night costs nothing", () => {
  const s = traitors(game([BANISHED], { lives: 2 }));
  // Episode 1: player 9 murdered, player 4 (a Faithful) banished; ann named 4: one of you saw it coming.
  night(s, 1, { murdered: [9], banished: [4], traitors: [0, 1] });
  // Episode 2: the Traitor player 0 banished: nothing to see coming.
  night(s, 2, { banished: [0] });
  // Episode 3: only a murder. Episode 4: nobody goes.
  night(s, 3, { murdered: [8] });
  night(s, 4);
  const rows = [...said(s, "banished", 1, { ann: 4, bo: 5 }), ...said(s, "banished", 2, { ann: 5, bo: 6, cy: 7 }), ...said(s, "banished", 3, { bo: 5 })];
  let r = walked(s, rows);
  assert.deepEqual(r.c, { lives: 2, of: 2, lost: [], result: null });
  assert.equal(r.w.ends, null);
  assert.deepEqual(r.w.out, {}, "nobody is knocked out");
  assert.deepEqual(r.w.lives, { ann: 2, bo: 2, cy: 2 }, "each with the couch's lives");
  assert.deepEqual(r.w.shared.sort(), ["ann", "bo", "cy"]);
  assert.deepEqual(r.w.totals, { ann: 1, bo: 0, cy: 0 }, "right answers still earn their points");
  // Episode 5: Faithful player 5 banished, named by nobody (bo named 6; ann and cy silent): one gone.
  night(s, 5, { banished: [5] });
  r = walked(s, [...rows, ...said(s, "banished", 5, { bo: 6 })]);
  assert.deepEqual(r.c.lost, [{ episode: 5, question: "banished" }]);
  assert.equal(r.c.lives, 1);
  // Episode 6: Faithful player 6 banished and nobody answered at all: nobody saw it coming, the last life goes, lost by all.
  night(s, 6, { banished: [6] });
  r = walked(s, [...rows, ...said(s, "banished", 5, { bo: 6 })]);
  assert.deepEqual(r.c, { lives: 0, of: 2, lost: [{ episode: 5, question: "banished" }, { episode: 6, question: "banished" }], result: "lost" });
  assert.equal(r.w.ends, 6);
  assert.equal(S.lastEpisode(r.v), 6);
  assert.equal(S.gameOver(r.v), true);
  assert.equal(S.KnockoutLogic.endedBefore(r.v, 7), true, "nothing after it is played");
  assert.equal(S.KnockoutLogic.isOut(r.v, "ann"), false, "the game ended; nobody was knocked out of it");
  // Everyone shares one place (the table's order is the engine's), each row the couch's lives.
  const rowsNow = S.computeScores(r.v);
  assert.deepEqual(rowsNow.map((x) => [x.playerId, x.total, x.lives, x.shared]), [["ann", 1, 0, true], ["bo", 0, 0, true], ["cy", 0, 0, true]]);
  assert.equal(new Set(rowsNow.map((x) => S.rankKey(r.v, x).join(","))).size, 1, "one shared place");
  // Listed by their points within it: who called the most first, whatever the order they joined in.
  const cyFirst = walked(s, [...rows, ...said(s, "banished", 5, { bo: 6 }), ...said(s, "banished", 6, { cy: 6 })]);
  assert.deepEqual(S.computeScores(cyFirst.v).map((x) => [x.playerId, x.total]), [["ann", 1], ["cy", 1], ["bo", 0]]);
  const cyMore = walked(s, [...said(s, "banished", 1, { cy: 4 }), ...said(s, "banished", 5, { cy: 5 }), ...said(s, "banished", 6, { ann: 7 })]);
  assert.deepEqual(S.computeScores(cyMore.v).map((x) => x.playerId), ["cy", "ann", "bo"]);
  // A state without its walk reads as the game would without its lives (its span's end): the safe fallback.
  assert.equal(S.lastEpisode(s), null);
});

test("who saves a night: one of you, most of those who answered, or all of them; silence neither helps nor hurts", () => {
  const four = ["ann", "bo", "cy", "di"];
  const make = (saves) => {
    const s = traitors(game([BANISHED], { lives: 3, ...(saves ? { saves } : {}) }), four);
    night(s, 1, { banished: [4], traitors: [0] });
    night(s, 2, { banished: [5] });
    night(s, 3, { banished: [6] });
    return s;
  };
  // Episode 1: two of four right; 2: one of two who answered right; 3: two of three right, di silent.
  const answers = (s) => [
    ...said(s, "banished", 1, { ann: 4, bo: 4, cy: 7, di: 8 }),
    ...said(s, "banished", 2, { ann: 5, bo: 7 }),
    ...said(s, "banished", 3, { ann: 6, bo: 6, cy: 9 }),
  ];
  const lost = (saves) => { const s = make(saves); return walked(s, answers(s)).c.lost.map((x) => x.episode); };
  assert.deepEqual(lost(undefined), [], "one right answer saves each night (the default)");
  assert.deepEqual(lost("most"), [1, 2], "half right isn't most; two of three who answered is");
  assert.deepEqual(lost("all"), [1, 2, 3], "anyone wrong costs it");
  // All of those who answered right, someone silent: saved.
  const s = make("all");
  assert.deepEqual(walked(s, [...said(s, "banished", 1, { ann: 4, bo: 4 }), ...said(s, "banished", 2, { cy: 5 }), ...said(s, "banished", 3, { di: 6 })]).c.lost, []);
});

test("each fallback: results still early, an earlier one left early, a corrected result, a recruit, a late joiner and a ghost", () => {
  const s = traitors(game([BANISHED], { lives: 1 }));
  night(s, 1, { banished: [4], traitors: [0, 1] });
  // Episode 2's early results (who went home, not yet what it implies): the night waits.
  const e2 = night(s, 2, { banished: [5] });
  S.EpisodeLogic.setResultsStage(s, e2.id, "early");
  const rows = [...said(s, "banished", 1, { ann: 4 }), ...said(s, "banished", 2, { ann: 6 })];
  let r = walked(s, rows);
  assert.deepEqual([r.c.lives, r.c.result, r.w.ends], [1, null, null], "a verdict still to settle stops the walk there");
  // Final: player 5 a Faithful, named by nobody: the one life goes.
  S.EpisodeLogic.setResultsStage(s, e2.id, "final");
  r = walked(s, rows);
  assert.deepEqual([r.c.lives, r.c.result, r.w.ends], [0, "lost", 2]);
  // A corrected result works it out again: Episode 2's banished was the Traitor player 1, so nothing was lost there.
  S.removeElimination(s, e2.id, cid(s, 5));
  S.addElimination(s, e2.id, cid(s, 1), "Banished");
  r = walked(s, rows);
  assert.deepEqual([r.c.lives, r.c.result, r.w.ends], [1, null, null]);
  // A recruit (The Traitors' twist: a Faithful made a Traitor) banished later counts as a Traitor: nothing to see coming.
  night(s, 3, { banished: [6], traitors: [6], role: "Recruited Traitor" });
  assert.deepEqual(walked(s, [...rows, ...said(s, "banished", 3, { bo: 7 })]).c.lost, []);
  // An earlier episode still early once a later one has results: never settles, so it costs nothing.
  const t = traitors(game([BANISHED], { lives: 1 }));
  const t1 = night(t, 1, { banished: [4], traitors: [0] });
  S.EpisodeLogic.setResultsStage(t, t1.id, "early");
  night(t, 2, { banished: [5] });
  const tw = walked(t, said(t, "banished", 2, { ann: 5 }));
  assert.deepEqual([tw.c.lives, tw.c.lost], [1, []]);
  // Late joiners: someone starting at Episode 3 saves nothing before it, and counts from then; a ghost (a late joiner's private
  // season) never counts; nor does someone still catching up (they answer nothing yet: answers.ts refuses it), though they share
  // the result.
  const u = traitors(game([BANISHED], { lives: 3 }), ["ann", "gh", "di", "eve"]);
  u.players.find((x) => x.id === "gh").ghost = true;
  u.players.find((x) => x.id === "di").lateJoin = { startEpisode: 1, catchingUp: true };
  u.players.find((x) => x.id === "eve").lateJoin = { startEpisode: 3, catchingUp: false };
  night(u, 1, { banished: [4], traitors: [0] });
  night(u, 2, { banished: [5] });
  night(u, 3, { banished: [6] });
  const uw = walked(u, [...said(u, "banished", 1, { gh: 4 }), ...said(u, "banished", 2, { eve: 5, di: 5 }), ...said(u, "banished", 3, { eve: 6 })]);
  assert.deepEqual(uw.c.lost.map((x) => x.episode), [1, 2], "the ghost's call saves nothing, nor di's while she catches up; eve's from her start");
  assert.deepEqual(uw.w.shared.sort(), ["ann", "di", "eve"], "the ghost is outside it");
  // A night every answer was void (F3 part 2: a pair re-drawn at the start, a group question asked each episode) costs nothing, as a
  // void pick does; one where nobody answered costs one.
  const PAIR = { id: "pair", ask: "Which pair loses someone?", answer: "group", points: 1, asked: "each", settle: { by: "results", take: "out" } };
  const p = S.defaultState();
  S.ensureNextEpisode(p);
  S.updateSettings(p, "showId", "survivor");
  S.updateSettings(p, "leagueTypeId", "questions");
  for (let i = 0; i < 8; i++) S.addCastaway(p, `Castaway ${i}`);
  p.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(p, "setupComplete", true);
  assert.deepEqual(S.setGame(p, game([PAIR], { lives: 1 }), { ctx: SURVIVOR_CTX }), []);
  S.addElimination(p, ep(p, 1).id, cid(p, 0), "Voted Out");
  const fg = {
    offered: [{ id: "g1", name: "A & B", members: [cid(p, 0), cid(p, 1)] }, { id: "g2", name: "C & D", members: [cid(p, 2), cid(p, 3)] }],
    byCastaway: new Map([[cid(p, 0), "g1"], [cid(p, 1), "g1"], [cid(p, 2), "g2"], [cid(p, 3), "g2"]]),
    lockSure: true,
    played: { sure: true, held: new Set(["g2"]) },
  };
  const facts = { ...A.facts(p), formatGroups: new Map([[1, fg]]) };
  const pairs = (by) => Object.entries(by).map(([playerId, answer]) => ({ playerId, question: "pair", episode: 1, answer }));
  assert.deepEqual(A.walk(p, pairs({ ann: "g1", bo: "g1" }), facts).coop.lost, [], "both picked a pair re-drawn at the start: void, no life lost");
  assert.deepEqual(A.walk(p, [], facts).coop.lost, [{ episode: 1, question: "pair" }], "nobody answered");
});

test("won by all at its end with a life left: the span's last episode, or the season's; a viewer behind sees it still playing", () => {
  const s = traitors(game([BANISHED], { lives: 2 }, { by: "coop" }, { from: 1, to: 3 }));
  night(s, 1, { banished: [4], traitors: [0] });
  night(s, 2, { banished: [5] });
  const rows = [...said(s, "banished", 1, { ann: 4 }), ...said(s, "banished", 2, { bo: 7 })];
  assert.deepEqual(walked(s, rows).c, { lives: 1, of: 2, lost: [{ episode: 2, question: "banished" }], result: null }, "still playing");
  night(s, 3, { banished: [0] });
  const r = walked(s, rows);
  assert.deepEqual([r.c.lives, r.c.result, r.w.ends], [1, "won", null], "the span's end with one left");
  assert.equal(S.gameOver(r.v), true);
  // A viewer who has seen only Episode 1 sees it still playing, both lives.
  const behind = S.GhostLogic.viewFor(s, "cy", 1);
  assert.deepEqual(A.walk(behind, rows, A.facts(behind)).coop, { lives: 2, of: 2, lost: [], result: null });
  // A copy that hides anything drops the walk (it's that copy's to work out again).
  assert.equal(A.walkOf(S.GhostLogic.viewFor(r.v, "cy", 1)), null);
  // To the season's end: its finale (the winner's) in, a life left.
  const f = traitors(game([BANISHED], { lives: 1 }), ["ann", "bo"], 6);
  night(f, 1, { banished: [4], traitors: [0] });
  const fin = ep(f, 2);
  S.addElimination(f, fin.id, cid(f, 1), "Finalist");
  S.addElimination(f, fin.id, cid(f, 2), "Finalist");
  S.addElimination(f, fin.id, cid(f, 3), "Winner");
  const fw = walked(f, said(f, "banished", 1, { ann: 4 }));
  assert.equal(fw.c.result, "won", "nobody banished at the finale: it doesn't count");
  // A game that never played an episode (it starts after the season ended) is no win.
  const late = traitors(game([BANISHED], { lives: 1 }, { by: "coop" }, { from: 3, to: null }), ["ann", "bo"], 6);
  night(late, 1, { banished: [4], traitors: [0] });
  const lf = ep(late, 2);
  S.addElimination(late, lf.id, cid(late, 1), "Finalist");
  S.addElimination(late, lf.id, cid(late, 3), "Winner");
  assert.equal(walked(late, []).c.result, null);
});

test("the Games tab's table: one shared place, the result on the view; the couch's standings leave co-op out of finishes", () => {
  const GV = jiti("../src/lib/game/game-view.ts");
  const s = traitors(game([BANISHED], { lives: 1 }));
  night(s, 1, { banished: [4], traitors: [0] });
  const w = A.walk(s, said(s, "banished", 1, { bo: 7 }), A.facts(s));
  const right = (p) => w.totals[p] ?? 0;
  const view = GV.gameView({ leagueId: "l", name: "g", gameType: "questions", gameName: "Q", yourRole: "player" }, A.withWalk(s, w), "cy", null, () => null, { right, move: null, walk: w });
  assert.equal(view.over, true);
  assert.deepEqual(view.table.map((r) => [r.playerId, r.rank, r.place]), [["ann", "T1", 1], ["bo", "T1", 1], ["cy", "T1", 1]]);
  assert.deepEqual(view.coop, { lives: 0, of: 1, lost: [{ episode: 1, question: "banished" }], result: "lost" });
  // The couch's standings: power rankings, head to head and finishes are against each other, so a co-op game isn't in them; the
  // trophy shelf keeps it, everyone its winners when it was won, nobody when it was lost; it's no title.
  const { rankingsOf, trophiesOf, yourNumbers } = jiti("../src/lib/game/couch-standings.ts");
  const people = ["ann", "bo", "cy"].map((n) => ({ userId: n, name: n }));
  const tied = ["ann", "bo", "cy"].map((u) => ({ userId: u, name: u, place: 1, rank: "T1", total: 0 }));
  const g = (over) => ({ leagueId: over.leagueId, name: "G", gameName: "Questions", gameType: "questions", seasonId: over.seasonId, showId: "tr", showName: "Traitors", label: over.label, span: null, artUrl: null, year: 2026, through: 5, ended: true, rows: over.rows, before: null, coop: over.coop });
  const won = g({ leagueId: "w", seasonId: "t4", label: "Traitors 4", rows: tied, coop: { result: "won", lives: 2, of: 5 } });
  const lost = g({ leagueId: "x", seasonId: "t5", label: "Traitors 5", rows: tied, coop: { result: "lost", lives: 0, of: 5 } });
  const versus = g({ leagueId: "v", seasonId: "t5", label: "Traitors 5", rows: [{ userId: "bo", name: "bo", place: 1, rank: "1", total: 9 }, { userId: "ann", name: "ann", place: 2, rank: "2", total: 4 }], coop: null });
  assert.equal(rankingsOf([won, lost], people, "ann", 2026), null, "co-op alone ranks nobody");
  const r = rankingsOf([won, lost, versus], people, "ann", 2026);
  assert.deepEqual(r.all.map((x) => [x.userId, x.total, x.games]), [["bo", 10, 1], ["ann", 1, 1]]);
  assert.deepEqual(r.h2h.map((h) => [h.userId, h.games]), [["bo", 1]], "only the game they played against each other");
  const t = trophiesOf([won, lost, versus], people, "ann");
  // A versus game after a co-op one the couch won isn't anyone running it back (everyone "won" the co-op one).
  assert.equal(t.plaques.find((x) => x.leagueId === "v").ranItBack, false);
  assert.ok(!t.records.some((x) => x.key === "ranItBack"));
  const plaque = (id) => t.plaques.find((p) => p.leagueId === id);
  assert.deepEqual(plaque("w").winners.map((x) => x.userId), ["ann", "bo", "cy"]);
  assert.deepEqual(plaque("w").coop, { result: "won" });
  assert.deepEqual(plaque("x").winners, [], "the show won");
  assert.equal(plaque("v").coop, undefined);
  assert.equal(t.titles, 0, "a co-op win is the couch's, not a title");
  assert.equal(t.seasons, 2, "you played both seasons");
  const you = yourNumbers([won, lost, versus], r, t, "ann");
  assert.deepEqual([you.seasons, you.bestFinish && you.bestFinish.rank], [2, "2"], "your best finish is against the couch");
});
