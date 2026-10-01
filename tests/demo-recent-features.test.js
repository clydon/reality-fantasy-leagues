// The demo seasons (all three league types, every episode cursor) against the features built on top of
// league state: lineup locks, original draft picks, the action bar's checks, spoiler trimming, scoring
// categories. Same made-up season as demo-active-roster.test.js, so no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { scoringGroups } = jiti("../src/lib/game/scoring-groups.ts");
const { actionItems } = require("../src/lib/game/action-items.js");
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
const TYPES = ["classic-draft", "active-roster", "pickem"];
const at = (type, cursor) => buildDemoState(data, type, cursor);

for (const type of TYPES) {
  test(`${type}: every cursor builds, and the features built on state don't throw`, () => {
    for (let cursor = 1; cursor <= EPISODES; cursor++) {
      const s = at(type, cursor);
      for (const p of s.players) actionItems(s, p.id);
      S.SpoilerLogic.viewThrough(s, Math.max(0, cursor - 1));
      S.computeScores(S.SpoilerLogic.viewThrough(s, 0));
      assert.ok(scoringGroups(s).length > 0);
    }
  });
}

test("active-roster: this week's lineup is open at every cursor before the finale", () => {
  for (let cursor = 1; cursor < EPISODES; cursor++) {
    const s = at("active-roster", cursor);
    const ep = S.currentEpisode(s);
    assert.ok(ep, `cursor ${cursor}: no current episode`);
    assert.equal(S.ActiveRosterLogic.isLineupLocked(s, ep.id), false, `cursor ${cursor}: episode ${ep.number} is locked`);
  }
});

test("pickem: this week's pick is open at every cursor before the finale", () => {
  for (let cursor = 1; cursor < EPISODES; cursor++) {
    const s = at("pickem", cursor);
    const ep = S.pickEmUpcomingEpisode(s);
    assert.ok(ep && ep.events.length === 0 && !S.hasAired(ep), `cursor ${cursor}: the pick is closed`);
  }
});

for (const type of ["classic-draft", "active-roster"]) {
  test(`${type}: everyone's original draft is a full roster at every cursor, whatever they swapped since`, () => {
    for (let cursor = 1; cursor <= EPISODES; cursor++) {
      const s = at(type, cursor);
      const size = S.rosterSize(s);
      for (const p of s.players) {
        const picks = S.originalDraftPicks(s, p.id);
        assert.equal(picks.length, size, `cursor ${cursor}: ${p.name} drafted ${picks.length}, roster is ${size}`);
      }
    }
  });
}

test("spoilers: hiding the last episode shows the league as it was the cursor before", () => {
  for (const type of TYPES) {
    for (let cursor = 3; cursor <= EPISODES; cursor++) {
      const now = at(type, cursor);
      const latest = S.SpoilerLogic.latestWithResults(now);
      if (latest < 2) continue;
      const hidden = S.SpoilerLogic.viewThrough(now, latest - 1);
      const out = (s) => s.castaways.filter((c) => c.status === "eliminated").map((c) => c.id).sort();
      const before = now.episodes.filter((e) => e.number === latest).flatMap((e) => e.events.map((ev) => ev.castawayId));
      assert.deepEqual(out(hidden), out(now).filter((id) => !before.includes(id)), `${type} cursor ${cursor}`);
    }
  }
});
