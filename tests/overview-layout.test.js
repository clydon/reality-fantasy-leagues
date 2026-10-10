// Overview layouts saved before a section existed still get it, and lose any section since removed
// (src/lib/overview-layout.ts's withNewSections). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { withNewSections, defaultOverviewOrder, OVERVIEW_SECTION_IDS, OVERVIEW_LEAGUE_TYPE_IDS } = jiti("../src/lib/overview-layout.ts");

test("each type's default order holds every section exactly once (the API requires it)", () => {
  for (const type of OVERVIEW_LEAGUE_TYPE_IDS) {
    const order = defaultOverviewOrder(type);
    assert.equal(order.length, OVERVIEW_SECTION_IDS.length, type);
    assert.deepEqual([...order].sort(), [...OVERVIEW_SECTION_IDS].sort(), type);
  }
});

test("a new section lands right after the one it follows by default, in a customized order", () => {
  // An admin's Active Roster order from before "yourLine" existed: Standings and Latest Episode first.
  const defaults = defaultOverviewOrder("active-roster");
  const saved = defaults.filter((id) => id !== "yourLine");
  const customized = ["standings", "latestEpisode", ...saved.filter((id) => id !== "standings" && id !== "latestEpisode")];
  const merged = withNewSections(customized, "active-roster");
  assert.equal(merged.indexOf("yourLine"), merged.indexOf("standings") + 1);
  assert.equal(merged.length, defaults.length, "every section, once");
  assert.equal(new Set(merged).size, merged.length);
});

test("an order that already has every section is left alone", () => {
  const reversed = [...defaultOverviewOrder("classic-draft")].reverse();
  assert.deepEqual(withNewSections(reversed, "classic-draft"), reversed);
});

test("sections removed from the app drop out of a saved order", () => {
  const old = ["leagueScoring", "standings", "seasonStatus", "lastWeek", ...defaultOverviewOrder("pickem").filter((id) => id !== "standings")];
  const merged = withNewSections(old, "pickem");
  assert.ok(!merged.includes("leagueScoring") && !merged.includes("seasonStatus") && !merged.includes("lastWeek"));
  assert.equal(merged.length, OVERVIEW_SECTION_IDS.length);
  assert.equal(merged[0], "standings");
});
