// The Active Roster demo replays a season under the league's defaults (shared, replenish when down to
// 2, a swap window every 3 episodes). Checks it against the real rules at every episode cursor, on a
// made-up season so no database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const S = require("../src/lib/game/state-logic.js");

// 20 castaways, one out per episode from episode 1, the last one standing wins in episode 12.
const EPISODES = 12;
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 20 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 20 - i,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 19 ? "Sole Survivor" : "Voted Out",
  })),
};
const at = (cursor) => S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", cursor))));

test("the demo runs under the Active Roster defaults", () => {
  const s = at(5);
  assert.equal(s.settings.ownershipMode, "shared");
  assert.equal(s.settings.replenishOrderBy, "rolling");
  assert.equal(S.MidSeasonLogic.replenishAt(s), 2);
  assert.equal(S.MidSeasonLogic.swapEvery(s), 3);
  assert.ok(S.replenishAvailable(s) && S.tradeAvailable(s));
  assert.ok(s.blindDraft.revealedAt, "the blind draft is finished, not waiting on picks");
});

test("at every cursor: legal rosters and lineups, and no move from the future or outside a window", () => {
  for (let cursor = 1; cursor <= EPISODES; cursor++) {
    const s = at(cursor);
    // Episode `cursor` has happened; the next one is this week (none after the finale).
    const current = s.episodes[s.episodes.length - 1];
    assert.equal(current.number, cursor < EPISODES ? cursor + 1 : cursor);
    if (cursor < EPISODES) assert.equal(S.ActiveRosterLogic.isLineupLocked(s, current.id), false, "next week's lineup is open");
    for (const p of s.players) {
      const owned = s.castaways.filter((c) => c.ownerIds.includes(p.id));
      assert.ok(owned.length <= 5, `cursor ${cursor}: ${p.name} owns ${owned.length}`);
      const lineup = S.activeRosterLineupFor(s, current.id, p.id);
      assert.ok(lineup.length <= 3);
      for (const id of lineup) assert.ok(owned.some((c) => c.id === id), `cursor ${cursor}: ${p.name} fields ${id} they don't own`);
    }
    for (const m of s.midSeason.log) {
      assert.ok(m.episode < cursor, `cursor ${cursor}: a move after episode ${m.episode} is shown too early`);
      if (m.type === "trade") assert.equal(m.episode % 3, 0, "swaps only in a window");
    }
  }
});

test("the players don't move in lockstep, and the season's end owes nothing", () => {
  const end = at(EPISODES);
  const totals = S.computeScores(end).map((r) => r.total);
  assert.ok(new Set(totals).size > 1, `everyone tied: ${totals}`);
  assert.ok(end.midSeason.log.length > 0, "some roster moves happened");
  for (const p of end.players) assert.equal(S.replenishNeed(end, p.id), 0);
  assert.equal(S.WaiverLogic.due(end, Date.now()), null, "no waiver week to open");
});
