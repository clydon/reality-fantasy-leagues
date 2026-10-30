// Early and final results' timing (src/lib/game/final-results.js): final results at 12:00 noon the day after an episode airs, in
// the season's own zone, and what the words say about it. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../src/lib/game/final-results.js");

const ET = "America/New_York";

test("final results: 12:00 noon the day after it airs, in the season's zone", () => {
  // Wed Oct 21, 8:00 PM EDT.
  assert.equal(F.finalResultsAt("2026-10-22T00:00:00Z", ET).toISOString(), "2026-10-22T16:00:00.000Z");
  // A late one (11:30 PM Eastern) still has the next day's noon, and so does one after midnight (12:30 AM: the night before's).
  assert.equal(F.finalResultsAt("2026-10-22T03:30:00Z", ET).toISOString(), "2026-10-22T16:00:00.000Z");
  assert.equal(F.finalResultsAt("2026-10-22T04:30:00Z", ET).toISOString(), "2026-10-22T16:00:00.000Z");
  // A morning one (9 AM) has the next day's.
  assert.equal(F.finalResultsAt("2026-10-22T13:00:00Z", ET).toISOString(), "2026-10-23T16:00:00.000Z");
  // Across the clocks going back (Sun Nov 1 2026): noon EST.
  assert.equal(F.finalResultsAt("2026-11-01T00:00:00Z", ET).toISOString(), "2026-11-01T17:00:00.000Z");
  // A season in London: noon there.
  assert.equal(F.finalResultsAt("2026-10-21T20:00:00Z", "Europe/London").toISOString(), "2026-10-22T11:00:00.000Z");
  assert.equal(F.finalResultsAt(null, ET), null);
});

test("the words: by its time in the reader's zone, soon once it's passed, in once final", () => {
  const at = "2026-10-22T16:00:00Z";
  const night = new Date("2026-10-22T02:00:00Z"); // 10 PM Eastern the night before
  assert.equal(F.finalLine("early", at, night, ET), "Final results by 12:00 PM tomorrow");
  assert.equal(F.finalLine("early", at, night, "America/Los_Angeles"), "Final results by 9:00 AM tomorrow");
  assert.equal(F.finalLine("early", at, new Date("2026-10-22T13:00:00Z"), ET), "Final results by 12:00 PM today");
  assert.equal(F.finalLine("early", at, new Date("2026-10-20T13:00:00Z"), ET), "Final results by 12:00 PM Thursday");
  assert.equal(F.finalLine("early", at, new Date("2026-10-22T16:30:00Z"), ET), "Final results soon");
  assert.equal(F.finalLine("final", at, night, ET), "Final results are in");
  assert.equal(F.finalLine("early", null, night, ET), null);
});
