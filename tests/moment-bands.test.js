// The castaway sheet's bands (src/lib/game/moment-bands.ts): a moment's band by its points against its rulebook's typical moment.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const jiti = require("jiti")(__filename);

const { typicalOf, bandOf, BANDS } = jiti("../src/lib/game/moment-bands.ts");

test("The typical moment is the median of the points that score", () => {
  assert.equal(typicalOf([0.5, 1, 2, 3, 4]), 2);
  assert.equal(typicalOf([1, 2]), 1.5);
  // Nothing at zero or below counts, and a rulebook where nothing scores has none.
  assert.equal(typicalOf([-2, 0, 0.5, 1]), 0.75);
  assert.equal(typicalOf([-1, 0]), null);
});

test("Setbacks always cost; neutral is at most half the typical moment; great from one and a half times it", () => {
  // Survivor 51's rulebook: typical +2.
  assert.equal(bandOf(-0.5, 2), "setback");
  assert.equal(bandOf(0, 2), "neutral");
  assert.equal(bandOf(1, 2), "neutral"); // zero votes, 2nd in the Immunity challenge
  assert.equal(bandOf(2, 2), "good"); // won the Reward challenge
  assert.equal(bandOf(2.5, 2), "good"); // got an idol
  assert.equal(bandOf(3, 2), "great"); // won the Immunity challenge
  // Big Brother's: typical +1, so winning Head of Household (+2) is great and getting eviction votes (+0.5) neutral.
  assert.equal(bandOf(2, 1), "great");
  assert.equal(bandOf(0.5, 1), "neutral");
  assert.equal(bandOf(1, 1), "good");
});

test("A rulebook with no typical moment goes by 1", () => {
  assert.equal(bandOf(0.5, null), "neutral");
  assert.equal(bandOf(1, null), "good");
  assert.equal(bandOf(1.5, 0), "great");
  assert.deepEqual(BANDS, ["great", "good", "neutral", "setback"]);
});
