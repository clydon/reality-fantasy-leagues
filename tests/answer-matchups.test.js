// Head to head on a game of questions (docs/PLAN-start-a-game-gpt.md step A11 part 4b): rank.by 'matchups' beside score.by
// 'answers', each episode everyone playing one of the others on that episode's points, which are what the answers settled by then
// add (a question over several episodes, or about the whole game, counts in the one it settles in). The answers live outside the
// state (game_answers), so the server walks them (AnswerLogic.walk, as part 2b's race and lives) and hands the engine each
// episode's points through it (the walk's series, plain data on the copy it reads: AnswerLogic.withWalk); MatchupLogic reads them
// there (MatchupLogic.series) where a draft's come from KnockoutLogic.series. Its shape, words and settings; the walk's series and
// the matchups over it; each fallback (results still early, a verdict still waiting, a corrected result, a night nobody answers or
// scores, a void pick, late joiners, a state without the walk); the playoffs, the game ending with its final, nothing after the
// season's finale; the table, the view and the trophy. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const A = S.AnswerLogic;
const M = S.MatchupLogic;
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

const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const IMMUNE = { id: "immune", ask: "Who wins immunity?", answer: "person", points: 2, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const WINNER = { id: "winner", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } };
const GONE = { id: "gone", ask: "Who'll be gone in the next two?", answer: "person", points: 2, asked: "every", every: 2, settle: { by: "results", take: "out" } };
const PAIR = { id: "pair", ask: "Which pair loses someone?", answer: "group", points: 1, asked: "each", settle: { by: "results", take: "out" } };
/** About the whole game, known only at its end (asked once). */
const MOST = { id: "most", ask: "Who wins the most immunities?", answer: "person", points: 2, settle: { by: "moment", moment: "individualImmunity", take: "most" } };
/** A game of questions asking `ask`, played head to head (`rank` the rest of its rank), `more` the rest of the spec. */
const h2h = (ask = [BOOT], rank = {}, more = {}) => ({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers" }, ask, rank: { by: "matchups", ...rank }, ...more });

const PLAYERS = ["ann", "bo", "cy", "di"];
/** A game of questions on Survivor with `n` castaways (C0...) and four players, its game `spec` through setGame. */
function league(spec, players = PLAYERS, n = 10) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "questions");
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => S.ensureEpisodeNumber(s, n, false);
/** Who went home in episode n (castaway indexes; [i, method] for another way out) and what happened in it ([moment, castaway
 *  index]); none of either, a quiet night. */
function results(s, n, outs, events = []) {
  const e = ep(s, n);
  for (const o of outs) {
    const [i, how] = Array.isArray(o) ? o : [o, "Voted Out"];
    S.addElimination(s, e.id, cid(s, i), how);
  }
  for (const [type, i] of events) S.addScoringEvent(s, e.id, type, cid(s, i));
  if (!outs.length && !events.length) S.EpisodeLogic.setNoExit(s, e.id, true);
  return e;
}
/** Answers to one question at an episode: { player: castaway index | answer }. */
const said = (s, question, n, by) =>
  Object.entries(by).map(([playerId, a]) => ({ playerId, question, episode: n, answer: Number.isInteger(a) ? cid(s, a) : a }));
/** The walk on the state as it is (facts as the grader takes them, `more` beside them), and a copy carrying it. */
const walked = (s, rows, more = {}) => {
  const w = A.walk(s, rows, { ...A.facts(s), ...more });
  return { w, v: A.withWalk(s, w) };
};
const record = (v) => Object.fromEntries(S.computeScores(v).map((r) => [r.playerId, r.matchups ? `${r.matchups.wins}-${r.matchups.losses}-${r.matchups.ties}` : null]));
const order = (v) => S.computeScores(v).map((r) => r.playerId);
/** Each walked episode's points by player (the series' growth), as MatchupLogic plays them. */
const weekly = (v) => M.run(v).weeks.map((x) => [x.number, Object.fromEntries(x.games.flatMap((g) => [[g.a, g.aPoints], ...(g.b ? [[g.b, g.bPoints]] : [])]))]);
// The round robin over the four (in the order they joined) each episode from 1: 1 ann-di bo-cy, 2 ann-cy di-bo, 3 ann-bo cy-di,
// then again.

test("head to head on a game of questions: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  const specs = [h2h(), h2h([BOOT, IMMUNE], { playoffs: { teams: 2 } }), h2h([BOOT], { odd: "bye", quiet: "tie", playoffs: { teams: 4, from: 8 } })];
  for (const s of specs) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.equal(G.typeOf(s), "questions");
    assert.deepEqual(G.specWaitsFor(s), []);
    // Back from the settings they write, whole.
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  const flags = G.flagsOf(G.fullSpec(specs[0]));
  assert.equal(flags.hasMatchups, true);
  assert.equal(flags.hasQuestions, true);
  assert.equal(flags.hasAnswerLives, false);
  assert.equal(flags.hasRace, false);
  // The walk's parts carry head to head (so the server walks it); its defaults are read, never filled in.
  assert.deepEqual(G.matchupParts(G.fullSpec(specs[0])), { odd: "median", quiet: "skip", playoffs: null });
  assert.deepEqual(G.answerParts(G.fullSpec(specs[1])), { race: null, cuts: [], lives: null, on: [], oneLeft: null, allOut: null, coop: null, matchups: { odd: "median", quiet: "skip", playoffs: { teams: 2, rounds: 1, from: null } }, teams: null, handicap: null });
  assert.equal(G.fullSpec(specs[0]).rank.odd, undefined);
  assert.deepEqual(G.fullSpec({ ...h2h(), rank: { playoffs: { teams: 2 } } }).rank, { playoffs: { teams: 2 }, by: "matchups" }, "a rank that says only its playoffs");
  // Its settings: questionsRank 'matchups', and what it says beyond that in rankMatchups (as a draft's).
  const st = G.withSpec(S.defaultState().settings, specs[2]);
  assert.equal(st.questionsRank, "matchups");
  assert.deepEqual(st.rankMatchups, { odd: "bye", quiet: "tie", playoffs: { teams: 4, from: 8 } });
  assert.equal(G.withSpec(S.defaultState().settings, specs[0]).rankMatchups, undefined);
  // Nobody races, is cut or loses a life beside it; co-op's who saves a night isn't its.
  assert.deepEqual(at(h2h([BOOT], {}, { score: { by: "answers", lives: 1 } })), ["rank.by"], "lives rank last one standing");
  assert.equal(G.typeOf(h2h([BOOT], {}, { score: { by: "answers", lives: 1 } })), null);
  assert.deepEqual(at(h2h([BOOT], { cut: [{ at: { every: 1 }, out: 1 }] })), ["rank.by"], "cuts rank last one standing");
  assert.deepEqual(at(h2h([BOOT], { race: { to: 5 } })), ["rank.race"], "a race is won on points");
  assert.equal(G.typeOf(h2h([BOOT], { race: { to: 5 } })), null);
  assert.deepEqual(at(h2h([BOOT], { oneLeft: "ends" })), ["rank.oneLeft"]);
  assert.deepEqual(at(h2h([BOOT], {}, { score: { by: "answers", saves: "one" } })), ["score.saves"]);
  // Settings that say head to head and lives keep both, so the check refuses them rather than one being lost.
  const both = G.specOf({ ...S.defaultState().settings, leagueTypeId: "questions", questions: [BOOT], questionsRank: "matchups", questionsLives: 1 });
  assert.equal(both.rank.by, "matchups");
  assert.equal(both.score.lives, 1);
  assert.deepEqual(at(both), ["rank.by"]);
  // The playoffs take no more than the couch has teams.
  assert.deepEqual(at(specs[1], { ...CTX, couch: 1 }), ["rank.playoffs.teams"]);
  assert.deepEqual(at(specs[1], { ...CTX, couch: 2 }), []);
  // The words: the sentence, and How it works saying what an episode's points are and what its matchups wait for.
  const d = (s) => G.describeSpec(s, { castaway: "castaway" });
  assert.match(d(specs[1]).sentence, /Each episode you play one of the others head to head: more points wins it\. The top two by wins make the playoffs, over the last episode\.$/);
  const rules = d(specs[0]).rules.join(" ");
  assert.match(rules, /Each episode you play one of the others head to head, everyone in turn/);
  assert.match(rules, /Your points in an episode are what your answers settled by then earn\. /);
  assert.match(rules, /An episode's matchups wait for its full results, and for its questions to be settled\./);
  assert.match(rules, /Most wins at the end wins\./);
  assert.doesNotMatch(rules, /Most points wins\./);
  assert.match(d(h2h([BOOT, GONE, WINNER])).rules.join(" "), /earn: one about more than one episode counts in the episode it's settled in, and one about the whole game counts in the episode it's settled in, at the end\./);
});

test("matchups on the answers' points: each episode's what the answers settled then add; the records, the table, the view", () => {
  const s = league(h2h([BOOT, IMMUNE]));
  // Episode 1: C0 goes home, C4 wins immunity. ann 1 + 2, cy 1, di 2: ann beats di, cy beats bo.
  results(s, 1, [0], [["individualImmunity", 4]]);
  const rows1 = [...said(s, "boot", 1, { ann: 0, bo: 1, cy: 0 }), ...said(s, "immune", 1, { ann: 4, di: 4 })];
  // Episode 2: C1 goes, C5 wins it. bo 1, di 1, cy 2: cy beats ann, di and bo tie.
  results(s, 2, [1], [["individualImmunity", 5]]);
  const rows2 = [...rows1, ...said(s, "boot", 2, { bo: 1, di: 1 }), ...said(s, "immune", 2, { cy: 5, ann: 6 })];
  const { w, v } = walked(s, rows2);
  assert.deepEqual(w.series, [{ number: 1, totals: { ann: 3, cy: 1, di: 2 } }, { number: 2, totals: { ann: 3, cy: 3, di: 3, bo: 1 } }]);
  assert.deepEqual(w.out, {});
  assert.equal(w.ends, null);
  assert.deepEqual(weekly(v), [[1, { ann: 3, di: 2, bo: 0, cy: 1 }], [2, { ann: 0, cy: 2, di: 1, bo: 1 }]]);
  assert.deepEqual(record(v), { cy: "2-0-0", ann: "1-1-0", di: "0-1-1", bo: "0-1-1" });
  // Ranked by wins, then the regular season's points (di 3, bo 1); the rows' totals are the walk's.
  assert.deepEqual(order(v), ["cy", "ann", "di", "bo"]);
  assert.deepEqual(S.computeScores(v).map((r) => r.total), [3, 3, 3, 1]);
  assert.deepEqual(S.computeScores(v).find((r) => r.playerId === "ann").matchups, { wins: 1, losses: 1, ties: 0, for: 3, against: 4, seed: null, tier: 0, alive: false, champion: false });
  // A state without the walk (a reader not taught it): nobody has played, the safe fallback.
  assert.deepEqual(record(s), { ann: "0-0-0", bo: "0-0-0", cy: "0-0-0", di: "0-0-0" });
  assert.deepEqual(M.run(s).weeks, []);
  // A copy that hides anything drops the walk (the spoiler guard's), so its matchups are that copy's to work out again.
  assert.equal(A.walkOf(S.SpoilerLogic.viewThrough(v, 1)), null);
  // The Games tab: the table ranks as the engine does (its points the walk's), each row's record on it; the view your matchups.
  const { tableOf, gameView } = jiti("../src/lib/game/game-view.ts");
  const right = (p) => w.totals[p] ?? 0;
  const table = tableOf(v, "ann", () => null, right);
  assert.deepEqual(table.map((x) => [x.playerId, x.rank, x.total, x.record.wins, x.record.ties]), [["cy", "1", 3, 2, 0], ["ann", "2", 3, 1, 0], ["di", "3", 3, 0, 1], ["bo", "4", 1, 0, 1]]);
  const ref = { leagueId: "l", name: "L", gameType: "questions", gameName: "Prediction Sheet", yourRole: null };
  const view = gameView(ref, s, "ann", null, () => null, { right, move: null, walk: w });
  assert.deepEqual(view.matchups.record, { wins: 1, losses: 1, ties: 0, for: 3, against: 4 });
  assert.deepEqual(view.matchups.next, { episode: 3, round: null, opponent: "bo", stand: null });
  assert.deepEqual(view.matchups.last, { episode: 2, round: null, opponent: "cy", stand: null, points: 0, against: 2, result: "loss" });
  assert.equal(view.table[0].playerId, "cy");
  assert.equal(view.over, false);
  // Without the walk handed over, the view reads as nobody played.
  assert.deepEqual(gameView(ref, s, "ann", null, () => null, { right, move: null }).matchups.record, { wins: 0, losses: 0, ties: 0, for: 0, against: 0 });
});

test("an episode's points are what settled by then: a question over two episodes in the one it ends, one about the game at the finale", () => {
  const s = league(h2h([BOOT, GONE, WINNER]), PLAYERS, 6);
  // Episode 1: C0 goes (bo called it). ann's "gone in the next two" (C1) and the winners (ann C5, di C4) wait.
  results(s, 1, [0]);
  // Episode 2: C1 goes (cy called it): ann's two-episode call settles here.
  results(s, 2, [1]);
  // Episode 3, the finale: C2, C3 and C4 go, C5 wins: ann's winner settles here; the second window (3 and 4) ends with the season.
  results(s, 3, [2, 3, 4, [5, "Sole Survivor"]]);
  const rows = [...said(s, "boot", 1, { bo: 0 }), ...said(s, "gone", 1, { ann: 1 }), ...said(s, "winner", 0, { ann: 5, di: 4 }), ...said(s, "boot", 2, { cy: 1 })];
  const { w, v } = walked(s, rows);
  assert.deepEqual(weekly(v), [[1, { ann: 0, di: 0, bo: 1, cy: 0 }], [2, { ann: 2, cy: 1, di: 0, bo: 0 }], [3, { ann: 5, bo: 0, cy: 0, di: 0 }]]);
  // 1: ann and di tie, bo beats cy; 2: ann beats cy, di and bo tie; 3: ann beats bo, cy and di tie on nothing (the night still
  // counts: ann scored).
  assert.deepEqual(record(v), { ann: "2-0-1", bo: "1-1-1", cy: "0-2-1", di: "0-0-3" });
  assert.equal(w.totals.ann, 7);
  assert.equal(S.gameOver(v), true, "the season's over");
});

test("each fallback: results still early, a verdict still waiting, a corrected result, a night nobody answers or scores, a void pick", () => {
  const s = league(h2h([BOOT, IMMUNE]));
  results(s, 1, [0], [["individualImmunity", 4]]);
  const rows1 = [...said(s, "boot", 1, { ann: 0, bo: 1 }), ...said(s, "immune", 1, { cy: 4 })];
  // Episode 2's early results (who went home, not yet the moments): its matchups wait, though the boot already shows in the table.
  const e2 = results(s, 2, [1]);
  S.EpisodeLogic.setResultsStage(s, e2.id, "early");
  const rows2 = [...rows1, ...said(s, "boot", 2, { bo: 1, di: 1 }), ...said(s, "immune", 2, { ann: 5 })];
  const early = walked(s, rows2);
  assert.deepEqual(early.w.series.map((x) => x.number), [1], "the newest, early, waits");
  assert.deepEqual(record(early.v), { ann: "1-0-0", cy: "1-0-0", bo: "0-1-0", di: "0-1-0" });
  assert.equal(early.w.totals.di, 1, "the table's points as they stand");
  // Episode 3 in: Episode 2 counts as it stands (nothing scored marked it final: its immunity never settles, its boot counts).
  results(s, 3, [2], [["individualImmunity", 6]]);
  const rows3 = [...rows2, ...said(s, "boot", 3, { ann: 2 }), ...said(s, "immune", 3, { cy: 6 })];
  const third = walked(s, rows3);
  assert.deepEqual(weekly(third.v).map(([n, p]) => [n, p.bo, p.di]), [[1, 0, 0], [2, 1, 1], [3, 0, 0]]);
  // 2: ann-cy 0-0 (bo and di scored, so not a quiet night: a tie), di-bo 1-1; 3: ann 1 beats bo, cy 2 beats di.
  assert.deepEqual(record(third.v), { ann: "2-0-1", cy: "2-0-1", bo: "0-2-1", di: "0-2-1" });
  // A corrected result works it out again: Episode 1's boot was C3, so ann was wrong too: ann and di tie on nothing (cy scored, so
  // the night counts), and ann drops a win.
  const e1 = ep(s, 1);
  S.removeElimination(s, e1.id, cid(s, 0));
  S.addElimination(s, e1.id, cid(s, 3), "Voted Out");
  const fixed = walked(s, rows3);
  assert.deepEqual(weekly(fixed.v)[0], [1, { ann: 0, di: 0, bo: 0, cy: 2 }]);
  assert.equal(M.run(fixed.v).weeks[0].games[0].result, "tie");
  assert.deepEqual(record(fixed.v), { cy: "2-0-1", ann: "1-0-2", di: "0-1-2", bo: "0-2-1" });

  // A night nobody answers, or nobody gets right: nobody scores, so it counts for nobody (skip, the default) or ties everyone.
  for (const [quiet, want] of [["skip", "1-0-0"], ["tie", "1-0-1"]]) {
    const q = league(h2h([BOOT], { quiet }));
    results(q, 1, [0]);
    results(q, 2, [1]);
    const x = walked(q, [...said(q, "boot", 1, { ann: 0 }), ...said(q, "boot", 2, { bo: 5, cy: 6 })]);
    assert.equal(M.run(x.v).weeks[1].quiet, true);
    assert.equal(record(x.v).ann, want, `quiet ${quiet}`);
  }
  // A night the question doesn't count (nobody went home: off) scores nobody either.
  const off = league(h2h([BOOT]));
  results(off, 1, []);
  assert.equal(M.run(walked(off, said(off, "boot", 1, { ann: 0, bo: 1 })).v).weeks[0].quiet, true);

  // A void pick (F3 part 2: a pair that didn't play the episode as offered) earns nothing either way; the rest decide the night.
  const p = league(h2h([PAIR]));
  results(p, 1, [0]);
  const offered = [{ id: "g1", name: "C0 & C1", members: [cid(p, 0), cid(p, 1)] }, { id: "g2", name: "C2 & C3", members: [cid(p, 2), cid(p, 3)] }, { id: "g3", name: "C4 & C5", members: [cid(p, 4), cid(p, 5)] }];
  const byCastaway = new Map(offered.flatMap((g) => g.members.map((m) => [m, g.id])));
  const fg = { offered, byCastaway, lockSure: true, played: { sure: true, held: new Set(["g1", "g2"]) } };
  // ann right (g1), di's pick (g3) void: ann beats di; bo (g2, wrong) and cy (nothing) on 0: a tie.
  const pv = walked(p, said(p, "pair", 1, { ann: "g1", bo: "g2", di: "g3" }), { formatGroups: new Map([[1, fg]]) });
  assert.deepEqual(record(pv.v), { ann: "1-0-0", bo: "0-0-1", cy: "0-0-1", di: "0-1-0" });
  // A verdict research is unsure of (Episode 2's pairs: no report yet) waits at the newest episode; once a later one is in, it
  // counts as it stands (nothing settles it: no points either way).
  results(p, 2, [2]);
  const unsure = { offered, byCastaway, lockSure: true, played: null };
  const two = [...said(p, "pair", 1, { ann: "g1", bo: "g2", di: "g3" }), ...said(p, "pair", 2, { bo: "g2" })];
  const waits = walked(p, two, { formatGroups: new Map([[1, fg], [2, unsure]]) });
  assert.deepEqual(waits.w.series.map((x) => x.number), [1], "Episode 2 waits for its report");
  results(p, 3, [4]);
  const later = walked(p, two, { formatGroups: new Map([[1, fg], [2, unsure], [3, fg]]) });
  assert.deepEqual(later.w.series.map((x) => x.number), [1, 2, 3]);
  assert.equal(M.run(later.v).weeks[1].quiet, true, "nothing settled Episode 2: nobody scored");
});

test("who plays: a late joiner from their start, someone catching up once caught up, a ghost outside", () => {
  const s = league(h2h([BOOT]), [...PLAYERS, "eve", "gh", "fay"]);
  s.players.find((p) => p.id === "gh").ghost = true;
  s.players.find((p) => p.id === "eve").lateJoin = { startEpisode: 2, catchingUp: false };
  s.players.find((p) => p.id === "fay").lateJoin = { startEpisode: 1, catchingUp: true };
  results(s, 1, [0]);
  results(s, 2, [1]);
  const { v } = walked(s, [...said(s, "boot", 1, { ann: 0, gh: 0 }), ...said(s, "boot", 2, { eve: 1, gh: 1 })]);
  const w = M.run(v);
  assert.equal(w.weeks[0].games.length, 2, "four at 1");
  assert.equal(w.weeks[1].games.length, 3, "five at 2 (eve in): one against the median");
  assert.ok(w.weeks.every((x) => x.games.every((g) => ![g.a, g.b].includes("gh") && ![g.a, g.b].includes("fay"))), "a ghost, and someone catching up, play nobody");
  const rows = S.computeScores(v);
  assert.equal(rows.find((r) => r.playerId === "gh").matchups, null);
  assert.equal(rows.find((r) => r.playerId === "eve").matchups.wins + rows.find((r) => r.playerId === "eve").matchups.losses + rows.find((r) => r.playerId === "eve").matchups.ties, 1);
  // Kept on every write (state.matchupSeats): fay, once caught up, plays from the first episode still to play.
  M.settleSeats(s);
  assert.deepEqual(s.matchupSeats, { ann: 1, bo: 1, cy: 1, di: 1, eve: 2 });
  s.players.find((p) => p.id === "fay").lateJoin.catchingUp = false;
  M.settleSeats(s);
  assert.equal(s.matchupSeats.fay, 3);
});

test("the playoffs on the answers' points; the game ending with its final; nothing after the season's finale plays", () => {
  // Episodes 1 to 4, the top two in the final at 4.
  const s = league(h2h([BOOT], { playoffs: { teams: 2 } }, { span: { from: 1, to: 4 } }));
  assert.equal(M.playoffsFrom(s), 4);
  for (let n = 1; n <= 3; n++) results(s, n, [n - 1]);
  // ann right every week, bo at 1 and 2, cy at 3: ann 3-0, then bo (2 points) and cy (1) on 1-2, bo seeded second.
  const rows = [...said(s, "boot", 1, { ann: 0, bo: 0 }), ...said(s, "boot", 2, { ann: 1, bo: 1 }), ...said(s, "boot", 3, { ann: 2, cy: 2 })];
  const three = walked(s, rows);
  assert.deepEqual(M.run(three.v).seeds, ["ann", "bo"]);
  assert.equal(S.gameOver(three.v), false);
  assert.equal(M.endedAt(three.v), null, "not ended: its final's still to play");
  // The final: bo right, ann wrong: bo the champion, first whatever the points; over at 4.
  const e4 = results(s, 4, [3]);
  // Its results still early: over (it's aired), but the final waits for them; not ended yet.
  S.EpisodeLogic.setResultsStage(s, e4.id, "early");
  const waiting = walked(s, [...rows, ...said(s, "boot", 4, { ann: 9, bo: 3 })]);
  assert.equal(M.run(waiting.v).champion, null);
  assert.equal(M.endedAt(waiting.v), null);
  S.EpisodeLogic.setResultsStage(s, e4.id, "final");
  const done = walked(s, [...rows, ...said(s, "boot", 4, { ann: 9, bo: 3 })]);
  assert.equal(M.endedAt(done.v), 4);
  assert.equal(M.run(done.v).champion, "bo");
  assert.deepEqual(order(done.v).slice(0, 2), ["bo", "ann"]);
  assert.equal(S.lastEpisode(done.v), 4);
  assert.equal(S.gameOver(done.v), true);
  // The couch's plaque: the champion's, no margin in points.
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const { trophiesOf } = jiti("../src/lib/game/couch-standings.ts");
  const standing = tableOf(done.v, "bo", (p) => `u-${p}`, (p) => done.w.totals[p] ?? 0).map((r) => ({ userId: r.userId, name: r.name, place: r.place, rank: r.rank, total: r.total, seat: r.playerId }));
  assert.equal(standing[0].userId, "u-bo");
  const game = { leagueId: "l1", name: "L", gameName: "Prediction Sheet", gameType: "questions", seasonId: "s1", showId: "sh", showName: "Survivor", label: "Survivor 51", artUrl: null, year: 2026, through: 4, ended: true, rows: standing, before: null, matchups: true };
  const shelf = trophiesOf([game], PLAYERS.map((p) => ({ userId: `u-${p}`, name: p })), "u-bo");
  assert.deepEqual(shelf.plaques[0].winners.map((x) => x.userId), ["u-bo"]);
  assert.equal(shelf.plaques[0].by, null);

  // Playoffs from an episode of their own, the season going on after: the game ends with its final, and nothing after it counts. A
  // question about the whole game (who wins the most immunities) settles at the final, in its points as in the table's.
  const f = league(h2h([BOOT, MOST], { playoffs: { teams: 2, from: 3 } }));
  results(f, 1, [0], [["individualImmunity", 5]]);
  results(f, 2, [1], [["individualImmunity", 5]]);
  results(f, 3, [2], [["individualImmunity", 6]]);
  results(f, 4, [3], [["individualImmunity", 6], ["individualImmunity", 6]]);
  const fr = [...said(f, "boot", 1, { ann: 0 }), ...said(f, "boot", 2, { bo: 1 }), ...said(f, "boot", 3, { ann: 2 }), ...said(f, "boot", 4, { bo: 3, cy: 3 }), ...said(f, "most", 0, { bo: 5, ann: 6 })];
  const fw = walked(f, fr);
  assert.deepEqual(fw.w.series.map((x) => x.number), [1, 2, 3], "nothing after the final walked");
  // Seeded ann, bo (a win and a tie each, a point each: ann joined first); the final: ann's boot (1) against bo's C5, the most
  // immunities through it (2: C6's at 4 come after the game).
  assert.deepEqual(M.run(fw.v).seeds, ["ann", "bo"]);
  assert.deepEqual(M.run(fw.v).rounds[0].games[0], { a: "ann", b: "bo", aSeed: 1, bSeed: 2, aPoints: 1, bPoints: 2, winner: "bo" });
  assert.equal(M.run(fw.v).champion, "bo");
  assert.deepEqual([fw.w.totals.ann, fw.w.totals.bo, fw.w.totals.cy], [2, 3, 0], "the table's points stand at the final");
  assert.equal(S.lastEpisode(fw.v), 3);
  assert.equal(S.gameOver(fw.v), true);
  assert.equal(M.endedAt(fw.v), 3);
  // spanView cuts the copy at the final and keeps the walk.
  assert.ok(A.walkOf(S.spanView(fw.v)));
  assert.equal(S.computeScores(fw.v)[0].playerId, "bo");

  // A schedule that counts a reunion (eight, the finale at 6): the final placed at 8 never plays; nothing after the finale counts,
  // a regular-season week nor a round; the season over first, seed 1 wins.
  const r = league(h2h([BOOT], { playoffs: { teams: 2 } }), PLAYERS, 7);
  r.seasonEpisodes = 8;
  for (let n = 1; n <= 5; n++) results(r, n, [n - 1]);
  results(r, 6, [5, [6, "Sole Survivor"]]);
  results(r, 7, []);
  results(r, 8, []);
  const rr = [...[1, 2, 3, 4, 5, 6].flatMap((n) => said(r, "boot", n, { cy: n - 1 })), ...said(r, "boot", 7, { ann: 0 })];
  const rw = walked(r, rr);
  assert.equal(M.playoffsFrom(rw.v), 8);
  assert.deepEqual(rw.w.series.map((x) => x.number), [1, 2, 3, 4, 5, 6], "the walk stops at the finale");
  assert.ok(M.run(rw.v).weeks.every((x) => x.number <= 6), "no week after the finale");
  assert.equal(M.run(rw.v).rounds[0].played, false);
  assert.equal(M.run(rw.v).champion, "cy", "seed 1, the season over first");
  assert.equal(S.gameOver(rw.v), true);
  assert.equal(M.endedAt(rw.v), 6, "it ended with the season's finale");
});
