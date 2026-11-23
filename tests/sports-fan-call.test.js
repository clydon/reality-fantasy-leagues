// A fan's call (src/lib/sports/fan-call.ts; docs/PLAN-sports-couch.md C2): its spec passes our check (Pick'em on one game, the winner
// shown as it's picked) and is told from a rivalry's by its margin; a call's backing and fading; a fan's calls record (fan's calls and
// rivalry calls on their team, ties apart); the couch on a fan's calls; the fan card's ticks. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { CALL_SPEC, pickedKindOf, backingOf, callsRecord, couchOnCalls, callTicks, record3Words, verdictOf } = jiti("../src/lib/sports/fan-call.ts");
const { RIVALRY_SPEC, isRivalrySpec } = jiti("../src/lib/sports/rivalry.ts");
const Spec = require("../src/lib/game/game-spec/index.js");

const G = "giants";
const B = "bears";
const E = "eagles";
const p = (userId, side) => ({ userId, name: userId, side });
const game = (event, kind, picks, winner, teams = [B, G]) => ({ event, kind, leagueId: `l-${event}`, seasonId: "s", at: null, begun: true, picks, winner, teams });

test("the call's spec is a valid one-question game with public picks, and isn't a rivalry", () => {
  const spec = { ...structuredClone(CALL_SPEC), span: { from: 1, to: 1 } };
  const problems = Spec.specProblems(spec, { sport: { league: "football/nfl" } }).filter((x) => /shown/.test(x.path ?? "") || /shown/i.test(x.problem));
  assert.deepEqual(problems, []);
  assert.equal(pickedKindOf(spec), "call");
  assert.equal(isRivalrySpec(spec), false);
  assert.equal(pickedKindOf(RIVALRY_SPEC), "rivalry");
  assert.equal(isRivalrySpec(RIVALRY_SPEC), true);
  assert.equal(pickedKindOf({ ask: [{ id: "winner", answer: "side" }] }), null);
});

test("backing and fading a call", () => {
  const g = { picks: [p("jordan", G), p("sam", B), p("casey", G), p("alex", B)] };
  const { back, fade } = backingOf(g, g.picks[0]);
  assert.deepEqual(back.map((x) => x.userId), ["casey"]);
  assert.deepEqual(fade.map((x) => x.userId), ["sam", "alex"]);
});

test("a fan's calls record: calls and rivalry calls on their team, a tie apart, unsettled games left out", () => {
  const games = [
    game("1", "call", [p("jordan", G), p("sam", B)], G),
    game("2", "call", [p("jordan", G)], B),
    game("3", "rivalry", [p("jordan", G), p("riley", E)], G, [G, E]),
    game("4", "call", [p("jordan", B)], B), // called against his team, and right
    game("5", "call", [p("jordan", G)], "tie"),
    game("6", "call", [p("jordan", G)], null),
    game("7", "call", [p("casey", "x")], "x", ["x", "y"]), // another team's game
  ];
  const teamsOf = (e) => games.find((g) => g.event === e)?.teams ?? null;
  assert.deepEqual(callsRecord("jordan", G, games, teamsOf), { w: 3, l: 1, t: 1 });
  assert.equal(record3Words({ w: 3, l: 1, t: 1 }), "3–1–1");
  assert.equal(record3Words({ w: 0, l: 0, t: 0 }), null);
});

test("the couch on a fan's calls: backers and faders, right or wrong, never a rivalry's sides", () => {
  const games = [
    game("1", "call", [p("jordan", G), p("sam", B), p("casey", G)], G),
    game("2", "call", [p("jordan", G), p("sam", B)], B),
    game("3", "rivalry", [p("jordan", G), p("sam", E)], G, [G, E]),
    game("4", "call", [p("riley", G), p("sam", B)], G), // someone else's call
  ];
  const { back, fade } = couchOnCalls("jordan", games);
  assert.deepEqual(back, { w: 1, l: 0, t: 0 });
  assert.deepEqual(fade, { w: 1, l: 1, t: 0 });
});

test("the fan card's ticks: one a game, right, wrong, open, none", () => {
  const season = ["1", "2", "3", "4", "5"].map((id) => ({ id, at: null }));
  const games = [game("1", "call", [p("jordan", G)], G), game("2", "call", [p("jordan", G)], B), game("4", "call", [p("jordan", G)], null), game("5", "call", [p("sam", B)], G)];
  assert.deepEqual(callTicks("jordan", season, games).map((t) => t.kind), ["right", "wrong", "none", "open", "none"]);
  assert.equal(verdictOf(G, G), "right");
  assert.equal(verdictOf(G, "tie"), null);
});
