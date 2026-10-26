// Playing solo (docs/PLAN-new-design.md step 9 part 3): a season's public pool (Survival Pool with a weekly Who goes home?
// call, since step 12 part 2 the person's Call it, read in from outside the state; its table the top ten and you, who's
// picked a count) and the practice couch's teams. On a made-up demo season, so no database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { gameView, poolCallOf, poolTop, POOL_TOP } = jiti("../src/lib/game/game-view.ts");
const { practiceTeams } = jiti("../src/lib/game/practice.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const CURSOR = 5; // results through episode 5; episode 6 is this week
const seats = (n) => Array.from({ length: n }, (_, i) => ({ key: `p${i}`, name: `player${i}`, color: "#000" }));
const data = (players) => ({
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES, players,
  castaways: Array.from({ length: 18 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: i + 1,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
});
const pool = (n = 3) => {
  const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data(seats(n)), "pickem", CURSOR))));
  s.settings.calls = true;
  return s;
};
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const ref = { leagueId: "l-pool", name: "Test 1 · Everyone", gameType: "pickem", gameName: "Survival Pool", yourRole: "member", solo: "public" };
const userOf = (p) => `user-${p}`;

test("Who goes home?: the pick's episode, anyone still in; your call and the right ones come from Call it", () => {
  const s = pool();
  const me = s.players[0].id;
  const still = s.castaways.filter((c) => c.status === "active");
  const gone = s.castaways.find((c) => c.status === "eliminated");
  assert.ok(S.pickEmCallsOn(s));
  const move = poolCallOf(s, still[1].id, 2);
  assert.equal(move.episode, 6);
  assert.equal(move.call, still[1].id);
  assert.deepEqual(move.available.sort(), still.map((c) => c.id).sort());
  assert.equal(move.right, 2);
  assert.equal(poolCallOf(s, gone.id, 0).call, null, "nobody already out");
  // The game view takes the calls it's handed: the move, and each player's right calls on the table.
  const g = gameView(ref, s, me, CURSOR, userOf, { right: (p) => (p === me ? 3 : 0), move });
  assert.equal(g.call.call, still[1].id);
  assert.equal(g.table.find((r) => r.you).calls, 3);
  // Calls off (a couch's Survival Pool): nothing handed in, nothing to call.
  const off = pool();
  off.settings.calls = false;
  assert.equal(gameView(ref, off, off.players[0].id, CURSOR, userOf).call, null);
  assert.ok(gameView(ref, off, off.players[0].id, CURSOR, userOf).table.every((r) => r.calls === 0));
});

test("a public pool's table: the top ten and you with your neighbours, the field counted, who's picked a count", () => {
  const s = pool(30);
  const me = s.players[20].id;
  const g = gameView(ref, s, me, CURSOR, userOf, { right: () => 0, move: poolCallOf(s, null, 0) });
  assert.equal(g.players, 30);
  assert.ok(g.table.length <= POOL_TOP + 3);
  assert.ok(g.table.some((r) => r.you));
  assert.ok(g.table.filter((r) => !r.you).every((r) => r.picks.every((p) => p.correct !== null)), "nobody else's pick before it's decided");
  assert.equal(g.progress.of, 30);
  assert.deepEqual(g.progress.people, [], "strangers aren't named");
  assert.ok(g.call && g.call.episode === 6 && g.call.open);
  assert.equal(g.from, 1);
  // The same league on a couch shows everyone.
  const couch = gameView({ ...ref, solo: null }, s, me, CURSOR, userOf);
  assert.equal(couch.table.length, 30);
  assert.equal(couch.progress.people.length, 30);
});

test("poolTop keeps the first ten, then you and either side of you", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ place: i + 1, you: i === 14 }));
  assert.deepEqual(poolTop(rows).map((r) => r.place), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16]);
  const top = rows.map((r, i) => ({ ...r, you: i === 3 }));
  assert.equal(poolTop(top).length, 10);
});

test("a practice couch's teams fit who's still in, four teams of at least two", () => {
  assert.deepEqual(practiceTeams("active-roster", 13), { activeSlots: 2, benchSlots: 1 });
  assert.deepEqual(practiceTeams("active-roster", 20), { activeSlots: 3, benchSlots: 2 });
  assert.deepEqual(practiceTeams("active-roster", 16), { activeSlots: 3, benchSlots: 1 });
  assert.deepEqual(practiceTeams("classic-draft", 18), { teamSize: 4 });
  assert.deepEqual(practiceTeams("classic-draft", 12), { teamSize: 3 });
  assert.equal(practiceTeams("classic-draft", 7), null);
});
