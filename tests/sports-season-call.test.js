// The season call (docs/PLAN-sports-couch.md C4; the design: docs/design-round/solo-fan-spec.md): a team's wins over a game's games,
// { by: 'final', take: 'wins', of }, a number asked once over the span, and a number right within `within` of it (0: exactly), each
// answer on its own rather than the closest. The check (schema.js), the grader (answers.js spanWins) and the words (describe.js).
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, specContextOf } = jiti("../src/lib/sports/index.ts");
const { specProblems, verdictOf, pointsFor, isRight } = require("../src/lib/game/game-spec/index.js");

const nfl = specContextOf(sportOf("football/nfl"));
const golf = specContextOf(sportOf("golf/pga"));
const problems = (spec, ctx) => specProblems(spec, ctx).map((p) => `${p.at}: ${p.problem}`);
const quiz = (ask, span) => ({ spec: 1, span, pool: { of: "cast", where: null }, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, closes: "start", ask });
const wins = (more = {}) => ({ id: "season", ask: "How many do they win?", answer: "number", points: 1, settle: { by: "final", take: "wins", of: "8" }, asked: "once", within: 0, ...more });
const game = (status, a, b, more = {}) => ({ status, sides: [{ id: "8", score: a }, { id: "3", score: b }], ...more });
const facts = (games, to = 4) => ({ from: 1, to, over: false, episodes: new Map(), names: new Map(), games: new Map(games.map((g, i) => [i + 1, g])) });

test("the check: a team's wins over the game's games, asked once, of a team, on a team sport; a number within a few of it", () => {
  assert.deepEqual(problems(quiz([wins()], { from: 1, to: 4 }), nfl), [], "the season call: the rest of a team's season");
  assert.deepEqual(problems(quiz([wins({ within: 1 })], { from: 3, to: null }), nfl), [], "within one, to the season's end");
  assert.ok(problems(quiz([wins({ asked: "each" })], { from: 1, to: 4 }), nfl).includes("ask[0].asked: A team's wins are the whole game's: ask it once"));
  assert.ok(problems(quiz([wins({ settle: { by: "final", take: "wins" } })], { from: 1, to: 4 }), nfl).some((p) => /Whose wins/.test(p)));
  assert.ok(problems(quiz([wins({ answer: "person", within: undefined })], { from: 1, to: 4 }), golf).some((p) => /no team's wins/.test(p)), "a field has none");
  assert.ok(problems(quiz([wins({ within: 9 })], { from: 1, to: 4 }), nfl).includes("ask[0].within: Within 0 to 5 of it"));
  assert.ok(problems(quiz([{ ...wins(), answer: "side", within: 1 }], { from: 1, to: 4 }), nfl).some((p) => /Only an order or a number/.test(p)));
});

test("the grader: the span's wins, waiting until every game is final; a tie and a loss aren't wins; a game called off counts nothing", () => {
  const q = wins();
  const so = verdictOf(q, 1, facts([game("final", 24, 17), game("final", 10, 13), game("in", 7, 0), game("pre", 0, 0)]));
  assert.equal(so.state, "waiting");
  assert.deepEqual(so.live, { value: 1 }, "one won so far");
  const done = verdictOf(q, 1, facts([game("final", 24, 17), game("final", 10, 13), game("final", 20, 20), game("off", 0, 0)]));
  assert.equal(done.state, "known");
  assert.equal(done.value, 1, "a win, a loss, a tie, one called off");
  const shootout = verdictOf(q, 1, facts([game("final", 2, 2, { sides: [{ id: "8", score: 2, shootout: 4 }, { id: "3", score: 2, shootout: 3 }] })], 1));
  assert.equal(shootout.value, 1, "level after a shootout: its winner's");
});

test("a number within: right only within it, each on its own (exactly, by default 0); without it, the closest as before", () => {
  const v = { state: "known", right: [], value: 4 };
  const answers = [{ playerId: "a", answer: 4 }, { playerId: "b", answer: 5 }, { playerId: "c", answer: 7 }];
  assert.deepEqual([...pointsFor(wins(), v, answers).entries()], [["a", 1]], "exactly: only a");
  assert.deepEqual([...pointsFor(wins({ within: 1 }), v, answers).entries()], [["a", 1], ["b", 1]], "within one: a and b");
  assert.equal(isRight(wins(), v, answers[2], answers), false, "a lone caller off by three isn't right");
  assert.deepEqual([...pointsFor(wins({ within: undefined }), v, [answers[2]]).entries()], [["c", 1]], "the closest alone, as before");
});
