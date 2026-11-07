// L3 part 3b (docs/PLAN-start-a-game-gpt.md track L): games ESPN called off, made up or moved, and which line an over/under plays by,
// on ESPN's own answers recorded after the fact (tests/fixtures/espn/mlb-schedule-called-off-2026.json, scripts/dev-test/
// record-espn-called-off.js: the Yankees' 2026, TB at NYY on May 23 postponed and made up on Sept 22 as a new event, BAL at NYY
// moved from Sept 26 to Sept 25 as the same event, BAL at NYY on Sept 27 cancelled). It checks: the scoreboard's reading of each
// (postponed and cancelled over and not played, said why; the makeup and the moved game final, their notes kept; a suspended game,
// none recorded, read as still being played); the grader on a game called off (each kind's words, nothing to count); an over/under
// on the game's own line (line 'game': waiting before it's kept, graded on the kept line, over known early past it, none kept by the
// start: off), one game's and each game's of a week, its words; and a game called off giving its episode results (StatsLogic.stamp).
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readScoreboard } = jiti("../src/lib/server/sports/espn.ts");
const { defaultsFor, specContextOf, sportOf } = jiti("../src/lib/sports/index.ts");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const REC = require("./fixtures/espn/mlb-schedule-called-off-2026.json");

const MLB = "baseball/mlb";
const day = (d) => readScoreboard(MLB, REC.days[d]);
const byId = (d, id) => day(d).find((e) => e.id === id);

test("ESPN's own answers after the fact: a rainout and a cancellation over and not played, said why; the makeup and the moved game final", () => {
  const rainout = byId("2026-05-23", "401815462");
  assert.deepEqual([rainout.state, rainout.final, rainout.called, rainout.note], ["post", false, "postponed", "Rain - Makeup date Sept 22"]);
  const cancelled = byId("2026-09-27", "401817103");
  assert.deepEqual([cancelled.state, cancelled.final, cancelled.called], ["post", false, "canceled"]);
  // Its makeup is a game of its own (a new event id), its note naming the day it's made up from.
  const makeup = byId("2026-09-22", "401873648");
  assert.deepEqual([makeup.state, makeup.final, makeup.called, makeup.note], ["post", true, null, "Doubleheader - Game 1 - Makeup from May 23"]);
  assert.notEqual(makeup.id, rainout.id);
  // A game moved a day keeps its event id, on its new day's scoreboard; its old day's hasn't got it.
  const moved = byId("2026-09-25", "401817088");
  assert.deepEqual([moved.final, moved.note], [true, "Doubleheader - Game 1 - Rescheduled from Sep. 26"]);
  assert.equal(day("2026-09-26").length, 0);
  // The summaries say the same after the fact, a postponed game's line still in its pickcenter.
  assert.equal(REC.summaries["401815462"].header.competitions[0].status.type.name, "STATUS_POSTPONED");
  assert.equal(REC.summaries["401815462"].pickcenter[0].overUnder, 7);
  assert.equal(REC.summaries["401815462"].plays, 0);
  // A suspended game (ESPN's 2025 and 2026 seasons list none: this one's made from the rainout) is still being played, whatever its
  // state says: finished later as the same game.
  const raw = JSON.parse(JSON.stringify(REC.days["2026-05-23"]));
  raw.events[0].status.type = { state: "post", completed: false, name: "STATUS_SUSPENDED", detail: "Suspended" };
  raw.events[0].competitions[0].status = raw.events[0].status;
  const suspended = readScoreboard(MLB, raw)[0];
  assert.deepEqual([suspended.state, suspended.final, suspended.called], ["in", false, "suspended"]);
  // A delayed game is just a game (ESPN's own state).
  raw.events[0].status.type = { state: "in", completed: false, name: "STATUS_RAIN_DELAY", detail: "Rain Delay" };
  raw.events[0].competitions[0].status = raw.events[0].status;
  assert.deepEqual([readScoreboard(MLB, raw)[0].state, readScoreboard(MLB, raw)[0].called], ["in", null]);
});

// A league of questions on the Yankees' recorded games: Episode 1 the makeup (NYY 2, TB 0), Episode 2 the rainout, Episode 3 the
// cancelled game, Episode 4 still to play.
const NYY = "10";
const TB = "30";
const BAL = "1";
const OU = { id: "runs", ask: "Total runs: over or under?", answer: "overUnder", settle: { by: "final", take: "total" }, points: 1, asked: "each", closes: "start", line: "game" };
function league(ask) {
  const pickem = defaultsFor("baseball").specs.pickem.spec;
  const s = S.defaultState();
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, { ...pickem, ask: [pickem.ask[0], ...ask] }, { ctx: specContextOf(sportOf(MLB)) }), []);
  for (let n = 1; n <= 4; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const final = (home, away, hs, as) => ({ status: "final", sides: [{ id: home, score: hs }, { id: away, score: as }], lines: {}, teams: {} });
const GAMES = new Map([
  [1, final(NYY, TB, 2, 0)],
  [2, { status: "off", called: "postponed", sides: [{ id: NYY, score: 0 }, { id: TB, score: 0 }], lines: {}, teams: {} }],
  [3, { status: "off", called: "canceled", sides: [{ id: NYY, score: 0 }, { id: BAL, score: 0 }], lines: {}, teams: {} }],
  [4, { status: "pre", sides: [{ id: NYY, score: 0 }, { id: BAL, score: 0 }], lines: {}, teams: {} }],
]);

test("a game called off: its questions don't count either way, said why (postponed, cancelled)", () => {
  const s = league([]);
  const facts = { ...S.AnswerLogic.facts(s), games: GAMES };
  const q = S.AnswerLogic.questions(s)[0];
  assert.deepEqual(G.verdictOf(q, 2, facts), { state: "off", why: "The game was postponed: it doesn't count either way" });
  assert.deepEqual(G.verdictOf(q, 3, facts), { state: "off", why: "The game was cancelled: it doesn't count either way" });
  // One called off before we knew why (read before 0306): as before.
  const unsaid = new Map([[2, { ...GAMES.get(2), called: undefined }]]);
  assert.equal(G.verdictOf(q, 2, { ...facts, games: unsaid }).why, "The game wasn't played: it doesn't count either way");
  assert.deepEqual(G.verdictOf(q, 1, facts).right, [NYY]);
  // Answers on the rainout earn nothing either way.
  const g = S.AnswerLogic.grade(s, [{ playerId: "ann", question: "winner", episode: 2, answer: NYY }, { playerId: "bo", question: "winner", episode: 1, answer: NYY }], facts);
  assert.equal(g.points.get("ann") ?? 0, 0);
  assert.equal(g.points.get("bo"), 1);
});

test("an over/under on the game's own line: graded on the line kept when it opened, waiting before, off with none kept by the start", () => {
  const s = league([OU]);
  const q = S.AnswerLogic.questions(s).find((x) => x.id === "runs");
  const lines = new Map([[G.lineKey(q, 1, ""), 7]]);
  const facts = { ...S.AnswerLogic.facts(s), games: GAMES, lines };
  // 2 runs against the 7 kept: under. The verdict says the line it played by.
  const v1 = G.verdictOf(q, 1, facts);
  assert.equal(v1.state, "known");
  assert.equal(v1.line, 7);
  assert.deepEqual(G.rightAnswers(q, v1, facts), ["under"]);
  const g = S.AnswerLogic.grade(s, [{ playerId: "ann", question: "runs", episode: 1, answer: "under" }, { playerId: "bo", question: "runs", episode: 1, answer: "over" }], facts);
  assert.equal(g.points.get("ann"), 1);
  assert.equal(g.points.get("bo") ?? 0, 0);
  // The listing's line moving after it was kept changes nothing: the kept one's the line.
  const moved = new Map([[1, { ...GAMES.get(1), listing: { name: null, startsAt: null, sides: [], line: 1.5 } }], ...[...GAMES].slice(1)]);
  assert.deepEqual(G.rightAnswers(q, G.verdictOf(q, 1, { ...facts, games: moved }), facts), ["under"]);
  // None kept by the time the game started: nobody could answer it.
  assert.deepEqual(G.verdictOf(q, 1, { ...facts, lines: new Map() }), { state: "off", why: "No line came out before the game: it doesn't count either way" });
  // Still to play: waiting; live past the kept line, over is known early (runs only add).
  assert.equal(G.verdictOf(q, 4, facts).state, "waiting");
  const live = new Map([[4, { status: "in", sides: [{ id: NYY, score: 5 }, { id: BAL, score: 4 }], lines: {}, teams: {} }]]);
  const early = G.verdictOf(q, 4, { ...facts, games: live, lines: new Map([[G.lineKey(q, 4, ""), 8.5]]) });
  assert.deepEqual([early.state, early.early, early.line, early.value], ["known", true, 8.5, 9]);
  assert.equal(G.verdictOf(q, 4, { ...facts, games: live, lines: new Map([[G.lineKey(q, 4, ""), 9.5]]) }).state, "waiting");
  // Called off: off as any of its questions.
  assert.equal(G.verdictOf(q, 2, facts).why, "The game was postponed: it doesn't count either way");
  // A fixed line plays as before.
  const fixed = league([{ ...OU, line: 1.5 }]);
  const fq = S.AnswerLogic.questions(fixed).find((x) => x.id === "runs");
  assert.deepEqual(G.rightAnswers(fq, G.verdictOf(fq, 1, { ...S.AnswerLogic.facts(fixed), games: GAMES }), {}), ["over"]);
});

test("an over/under on each game of a week, each by its own line: one with none kept off, one called off off, the rest graded", () => {
  const s = league([{ ...OU, each: "game" }]);
  const q = S.AnswerLogic.questions(s).find((x) => x.id === "runs");
  const week = new Map([["401873648", GAMES.get(1)], ["401817034", final(NYY, TB, 1, 6)], ["401815462", GAMES.get(2)], ["zt-noline", final(NYY, BAL, 3, 2)]]);
  const slate = new Map([[1, week]]);
  const lines = new Map([[G.lineKey(q, 1, "401873648"), 7], [G.lineKey(q, 1, "401817034"), 8.5], [G.lineKey(q, 1, "401815462"), 7]]);
  const facts = { ...S.AnswerLogic.facts(s), slate, lines };
  const v = G.verdictOf(q, 1, facts);
  assert.equal(v.state, "known");
  assert.deepEqual(G.rightAnswers(q, v.each["401873648"], facts), ["under"]);
  assert.deepEqual(G.rightAnswers(q, v.each["401817034"], facts), ["under"]);
  assert.equal(v.each["401815462"].why, "The game was postponed: it doesn't count either way");
  assert.equal(v.each["zt-noline"].why, "No line came out before the game: it doesn't count either way");
  const g = S.AnswerLogic.grade(s, [{ playerId: "ann", question: "runs", episode: 1, answer: { "401873648": "under", "401817034": "over", "401815462": "over", "zt-noline": "over" } }], facts);
  assert.equal(g.points.get("ann"), 1, "the makeup's under right; the second game's over wrong; the rainout and the game with no line nothing");
  assert.equal(G.answerProblem(q, { "401873648": "under" }, new Map([["401873648", new Set([NYY, TB])]])), null);
});

test("a game's own line in words: the question's, and each game's of a week", () => {
  const one = G.describeSpec(G.fullSpec({ ...defaultsFor("baseball").specs.pickem.spec, ask: [OU] }));
  const text = JSON.stringify(one);
  assert.match(text, /The line is the game's own, set when the question opens, and it won't change after\./);
  const each = JSON.stringify(G.describeSpec(G.fullSpec({ ...defaultsFor("baseball").specs.pickem.spec, ask: [{ ...OU, each: "game" }] })));
  assert.match(each, /Each game is over or under its own line, set when you can first pick it, and it won't change after\./);
  // A fixed line, still its number.
  assert.match(JSON.stringify(G.describeSpec(G.fullSpec({ ...defaultsFor("baseball").specs.pickem.spec, ask: [{ ...OU, line: 8.5 }] }))), /The line is 8\.5\./);
  // Playable, and nothing left to fill in (a line null still waits for the wizard).
  assert.deepEqual(G.specWaitsFor({ ...defaultsFor("baseball").specs.pickem.spec, ask: [OU] }), []);
  assert.equal(G.specWaitsFor({ ...defaultsFor("baseball").specs.pickem.spec, ask: [{ ...OU, line: null }] }).length, 1);
});

test("a game called off gives its episode results (nothing happened): the reveal, the week and the mark move past it", () => {
  const s = league([]);
  const e2 = s.episodes.find((e) => e.number === 2);
  assert.equal(S.EpisodeLogic.hasResults(e2), false);
  // sports/score.ts stampStats hands an episode whose one game is called off over as final.
  S.StatsLogic.stamp(s, { finals: [1, 2], games: { 2: { status: "off", sides: GAMES.get(2).sides } } });
  assert.equal(S.EpisodeLogic.hasResults(e2), true);
  assert.equal(e2.gameScore.status, "off");
});
