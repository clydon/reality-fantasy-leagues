// Overview layouts saved before a section existed still get it (src/lib/overview-layout.ts's
// withNewSections). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { withNewSections, DEFAULT_OVERVIEW_ORDER } = jiti("../src/lib/overview-layout.ts");

test("a new section lands right after the one it follows by default, in a customized order", () => {
  // An admin's Active Roster order from before "yourLine" existed: Standings and Latest Episode first.
  const saved = DEFAULT_OVERVIEW_ORDER.filter((id) => id !== "yourLine");
  const customized = ["standings", "latestEpisode", ...saved.filter((id) => id !== "standings" && id !== "latestEpisode")];
  const merged = withNewSections(customized);
  assert.equal(merged.indexOf("yourLine"), merged.indexOf("latestEpisode") + 1);
  assert.equal(merged.length, DEFAULT_OVERVIEW_ORDER.length, "every section, once");
  assert.equal(new Set(merged).size, merged.length);
});

test("an order that already has every section is left alone", () => {
  const reversed = [...DEFAULT_OVERVIEW_ORDER].reverse();
  assert.deepEqual(withNewSections(reversed), reversed);
});
