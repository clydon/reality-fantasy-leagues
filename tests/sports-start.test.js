// U1's sports slice, Start a game on a team (docs/PLAN-start-a-game-gpt.md U1; src/lib/sports/start-games.ts): the rail of a
// sport's standard games for some of its games, each named as U0's board names it, in the engine's own words, and fitting by our
// check with the span set: one team's games take the per-game and small-draft games, a league's slate the season-long ones too.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportRail, railSpec } = jiti("../src/lib/sports/start-games.ts");

test("a team's games: Pick'em first, then the per-game and small-draft games, each fitting", () => {
  for (const [league, count] of [["football/nfl", 1], ["baseball/mlb", 3], ["basketball/nba", 60], ["hockey/nhl", 4]]) {
    const rail = sportRail(league, { count });
    assert.equal(rail[0].id, "pickem", league);
    assert.ok(!rail.some((g) => g.id === "season" || g.id === "roto"), `${league}: no season-long game on one team's games`);
    for (const g of rail) {
      assert.equal(g.why, null, `${league} ${g.id}: ${g.why}`);
      assert.ok(g.name && g.line && g.rules.length, `${league} ${g.id} has words`);
    }
  }
  assert.ok(sportRail("football/nfl", { count: 1 }).some((g) => g.id === "squares"), "squares on a football game");
  assert.ok(!sportRail("baseball/mlb", { count: 3 }).some((g) => g.id === "squares"), "no squares where the sport has none");
});

test("a league's slate takes the season league", () => {
  const rail = sportRail("football/nfl", { count: 18, slate: true });
  assert.deepEqual(rail.map((g) => g.id).slice(0, 2), ["pickem", "season"]);
});

test("railSpec sets the span and leaves the default alone", () => {
  const rail = sportRail("football/nfl", { count: 1 });
  const s = railSpec(rail[0].spec, 4, 6);
  assert.deepEqual(s.span, { from: 4, to: 6 });
  assert.deepEqual(rail[0].spec.span, { from: 1, to: null });
});
