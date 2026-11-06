// Daylight saving: every schedule edge a clock change touches, so a lineup lock, a reminder or final results never move an
// hour (src/lib/game/air-schedule.js, db/episode-research.js nextEpisodeFrom, src/lib/game/final-results.js). Survivor 51's
// Episode 7 (Wed 2026-11-04, after the clocks went back on Sunday 11-01) was filed by research as "20:00-04:00", Eastern
// daylight time, so it read 7 PM EST and would have locked lineups an hour early: exactInZone reads such a slip as the
// announced time in the season's zone. Add a case here for any new place that turns a season's time into an instant.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Air = require("../src/lib/game/air-schedule.js");
const Research = require("../db/episode-research.js");
const Final = require("../src/lib/game/final-results.js");

const iso = (d) => (d ? d.toISOString() : d);
const NY = "America/New_York";

test("a season's time in its zone, on both sides of each clock change", () => {
  // 2026: clocks go back Sun Nov 1; 2027: forward Sun Mar 14.
  assert.equal(iso(Air.zonedToUtc("2026-10-28", "20:00", NY)), "2026-10-29T00:00:00.000Z", "8 PM EDT");
  assert.equal(iso(Air.zonedToUtc("2026-11-04", "20:00", NY)), "2026-11-05T01:00:00.000Z", "8 PM EST");
  assert.equal(iso(Air.zonedToUtc("2027-03-10", "20:00", NY)), "2027-03-11T01:00:00.000Z", "8 PM EST");
  assert.equal(iso(Air.zonedToUtc("2027-03-17", "20:00", NY)), "2027-03-18T00:00:00.000Z", "8 PM EDT");
  // The change's own night: an evening show is past it either way.
  assert.equal(iso(Air.zonedToUtc("2026-11-01", "20:00", NY)), "2026-11-02T01:00:00.000Z");
  assert.equal(iso(Air.zonedToUtc("2027-03-14", "20:00", NY)), "2027-03-15T00:00:00.000Z");
  // The repeated hour (1:30 AM twice) and the skipped one (2:30 AM never): some real instant, within the hour.
  const twice = Air.zonedToUtc("2026-11-01", "01:30", NY).getTime();
  assert.ok([Date.parse("2026-11-01T05:30:00Z"), Date.parse("2026-11-01T06:30:00Z")].includes(twice));
  const never = Air.zonedToUtc("2027-03-14", "02:30", NY).getTime();
  assert.ok(Math.abs(never - Date.parse("2027-03-14T07:00:00Z")) <= 3600 * 1000);
  // Elsewhere: London goes back a week earlier, Sydney's summer is ours' winter, Tokyo never changes.
  assert.equal(iso(Air.zonedToUtc("2026-10-24", "21:00", "Europe/London")), "2026-10-24T20:00:00.000Z", "BST");
  assert.equal(iso(Air.zonedToUtc("2026-10-31", "21:00", "Europe/London")), "2026-10-31T21:00:00.000Z", "GMT");
  assert.equal(iso(Air.zonedToUtc("2026-10-03", "19:30", "Australia/Sydney")), "2026-10-03T09:30:00.000Z", "AEST");
  assert.equal(iso(Air.zonedToUtc("2026-10-10", "19:30", "Australia/Sydney")), "2026-10-10T08:30:00.000Z", "AEDT");
  assert.equal(iso(Air.zonedToUtc("2026-11-04", "21:00", "Asia/Tokyo")), "2026-11-04T12:00:00.000Z");
});

test("a weekly season keeps its time on the clock across each change", () => {
  const fall = { premiereDate: "2026-09-23", airTime: "20:00", airTz: NY };
  assert.equal(iso(Air.episodeAirTime(fall, 6, {})), "2026-10-29T00:00:00.000Z", "Episode 6, Oct 28: 8 PM EDT");
  assert.equal(iso(Air.episodeAirTime(fall, 7, {})), "2026-11-05T01:00:00.000Z", "Episode 7, Nov 4: 8 PM EST");
  const spring = { premiereDate: "2027-02-24", airTime: "20:00", airTz: NY };
  assert.equal(iso(Air.episodeAirTime(spring, 3, {})), "2027-03-11T01:00:00.000Z", "Mar 10: 8 PM EST");
  assert.equal(iso(Air.episodeAirTime(spring, 4, {})), "2027-03-18T00:00:00.000Z", "Mar 17: 8 PM EDT");
  // Weekly on from an exact start before the change: by its date on the clock, not 7 days of hours.
  const dates = { 6: "2026-10-29T00:00:00Z" };
  assert.equal(iso(Air.episodeAirTime(fall, 7, dates)), "2026-11-05T01:00:00.000Z");
  // A nightly season through the change's own weekend.
  const nightly = { premiereDate: "2026-10-30", airTime: "23:35", airTz: NY, release: "nightly" };
  assert.equal(iso(Air.episodeAirTime(nightly, 1, {})), "2026-10-31T03:35:00.000Z", "Fri: 11:35 PM EDT");
  assert.equal(iso(Air.episodeAirTime(nightly, 4, {})), "2026-11-03T04:35:00.000Z", "Mon: 11:35 PM EST");
});

test("an exact start written with the offset from before the change is the announced time in the season's zone", () => {
  // Survivor 51's Episode 7 as research filed it: 8 PM, with October's daylight-time offset.
  assert.equal(iso(Air.exactInZone("2026-11-04T20:00:00-04:00", NY)), "2026-11-05T01:00:00.000Z", "8 PM EST, not 7");
  assert.equal(iso(Air.exactInZone("2027-03-17T20:00:00-05:00", NY)), "2027-03-18T00:00:00.000Z", "spring: 8 PM EDT, not 9");
  // Written right: as it is, a special at another time included.
  assert.equal(iso(Air.exactInZone("2026-11-04T20:00:00-05:00", NY)), "2026-11-05T01:00:00.000Z");
  assert.equal(iso(Air.exactInZone("2026-11-04T19:00:00-05:00", NY)), "2026-11-05T00:00:00.000Z", "a 7 PM special stays at 7");
  assert.equal(iso(Air.exactInZone("2026-10-28T20:00:00-04:00", NY)), "2026-10-29T00:00:00.000Z", "before the change");
  assert.equal(iso(Air.exactInZone("2026-11-05T01:00:00Z", NY)), "2026-11-05T01:00:00.000Z", "UTC is no zone's slip here");
  // Announced in another zone: taken as it is (5 PM Pacific is 8 PM Eastern).
  assert.equal(iso(Air.exactInZone("2026-11-04T17:00:00-08:00", NY)), "2026-11-05T01:00:00.000Z");
  // Other zones: London's winter offset in summer, Sydney's both ways, Tokyo's never wrong.
  assert.equal(iso(Air.exactInZone("2026-07-01T21:00:00+00:00", "Europe/London")), "2026-07-01T20:00:00.000Z", "9 PM BST");
  assert.equal(iso(Air.exactInZone("2026-10-10T19:30:00+10:00", "Australia/Sydney")), "2026-10-10T08:30:00.000Z", "7:30 PM AEDT");
  assert.equal(iso(Air.exactInZone("2026-11-04T21:00:00+09:00", "Asia/Tokyo")), "2026-11-04T12:00:00.000Z");
  // No zone, or not an exact start: as exactAirTime has it.
  assert.equal(iso(Air.exactInZone("2026-11-04T20:00:00-04:00", null)), "2026-11-05T00:00:00.000Z");
  assert.equal(Air.exactInZone("2026-11-04T20:00", NY), null);
  assert.equal(Air.exactInZone(null, NY), null);
});

test("research's next episode, announced before the change for a night after it", () => {
  const now = new Date("2026-10-29T03:00:00Z"); // the night Episode 6 aired
  const clean = (airsAt) => iso(Research.nextEpisodeFrom({ airsAt }, { tz: NY, airTime: "20:00", now }).airAt);
  assert.equal(clean("2026-11-04T20:00:00-04:00"), "2026-11-05T01:00:00.000Z", "the slip: 8 PM EST");
  assert.equal(clean("2026-11-04T20:00:00-05:00"), "2026-11-05T01:00:00.000Z", "written right");
  assert.equal(clean("2026-11-04T20:00"), "2026-11-05T01:00:00.000Z", "no offset: the season's zone");
  assert.equal(clean("2026-11-04"), "2026-11-05T01:00:00.000Z", "a date: the usual start");
});

test("final results at noon the day after, on the clock, across the change", () => {
  assert.equal(iso(Final.finalResultsAt("2026-10-29T00:00:00Z", NY)), "2026-10-29T16:00:00.000Z", "Oct 29, 12 PM EDT");
  assert.equal(iso(Final.finalResultsAt("2026-11-01T00:00:00Z", NY)), "2026-11-01T17:00:00.000Z", "Sat Oct 31's: Sun 12 PM EST");
  assert.equal(iso(Final.finalResultsAt("2026-11-05T01:00:00Z", NY)), "2026-11-05T17:00:00.000Z", "Nov 5, 12 PM EST");
  assert.equal(iso(Final.finalResultsAt("2027-03-14T01:00:00Z", NY)), "2027-03-14T16:00:00.000Z", "Sat Mar 13's: Sun 12 PM EDT");
});
