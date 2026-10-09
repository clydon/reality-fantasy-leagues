// One team's episode as the Overview's Latest Episode card and the Scoreboard's episode rows show it
// (src/lib/game/team-episode-breakdown.ts). Runs on a made-up Active Roster demo season, so no
// database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { scoredEpisodes, teamEpisodeBreakdown } = jiti("../src/lib/game/team-episode-breakdown.ts");
const { episodePlayerPoints } = jiti("../src/lib/game/active-roster-rows.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 20 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 20 - i,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 19 ? "Sole Survivor" : "Voted Out",
  })),
};
const state = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", 6))));

test("scored episodes are newest first and never past the reveal", () => {
  const eps = scoredEpisodes(state);
  assert.ok(eps.length > 0);
  assert.ok(eps[0].number <= 6);
  for (let i = 1; i < eps.length; i++) assert.ok(eps[i - 1].number > eps[i].number);
});

test("an episode's lineup points match the episode points everywhere else", () => {
  for (const ep of scoredEpisodes(state)) {
    for (const { player, points } of episodePlayerPoints(state, ep.id)) {
      const b = teamEpisodeBreakdown(state, ep.id, player.id);
      assert.equal(b.lineup, points, `ep ${ep.number} ${player.name}`);
      assert.equal(b.total, S.roundPoints(b.lineup + b.predictions));
      // Starters' lines add up to the lineup figure; the bench never counts.
      assert.equal(S.roundPoints(b.started.reduce((t, l) => t + l.points, 0)), b.lineup);
      const started = new Set(S.activeRosterLineupFor(state, ep.id, player.id));
      for (const l of b.started) assert.ok(started.has(l.c.id));
      for (const l of b.benched) assert.ok(!started.has(l.c.id));
    }
  }
});

test("a missing episode or player comes back empty", () => {
  const ep = scoredEpisodes(state)[0];
  assert.equal(teamEpisodeBreakdown(state, "ep_missing", state.players[0].id).total, 0);
  assert.deepEqual(teamEpisodeBreakdown(state, ep.id, "nobody").started, []);
});
