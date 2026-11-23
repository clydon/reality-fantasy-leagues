// A team's season as its page draws it (src/lib/sports/team-season.ts; docs/PLAN-sports-couch.md B2, a team's page): the record
// and streak, football's bye from the league's weeks, the season's strip (margins, the bye, the playoffs' start), its words for a
// screen reader, a daily sport's homestands and road trips, a series's places, the month the schedule opens on, and ordinals.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { recordOf, streakOf, byesOf, stripOf, stripWords, runsOf, seriesPlaces, focusMonth, ordinal } = jiti("../src/lib/sports/team-season.ts");

let n = 0;
// Noon UTC: the same day in the East.
const g = (day, vs, home, score, extra = {}) => {
  const final = !!score;
  const result = final ? (score[0] > score[1] ? "W" : score[0] < score[1] ? "L" : "T") : null;
  return { id: extra.id ?? `g${++n}`, at: `${day}T17:00:00Z`, state: final ? "post" : "pre", final, stage: extra.stage ?? "regular", home, opponent: { id: vs }, score, result, calledOff: !!extra.off };
};

test("the record counts the regular season's finals; the streak reads the latest", () => {
  const games = [g("2026-09-06", "a", true, [20, 10], { stage: "pre" }), g("2026-09-13", "b", false, [24, 17]), g("2026-09-20", "c", true, [10, 13]), g("2026-09-27", "d", true, [21, 21]), g("2026-10-04", "e", false, [30, 3]), g("2026-10-11", "f", true, [27, 20]), g("2026-10-18", "g", true, null)];
  assert.equal(recordOf(games), "3–1–1");
  assert.equal(streakOf(games), "Won 2");
  assert.equal(recordOf([g("2026-10-18", "g", true, null)]), null);
});

test("a bye is a regular week between the first and last game with none of theirs", () => {
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const weeks = [1, 2, 3, 4].map((k) => ({ label: `Week ${k}`, from: day(Date.UTC(2026, 8, 8 + (k - 1) * 7)), to: day(Date.UTC(2026, 8, 14 + (k - 1) * 7)) }));
  weeks.push({ label: "Wild Card", from: "2026-10-06", to: "2026-10-12" });
  const games = [g("2026-09-13", "a", true, [1, 0]), g("2026-09-27", "b", true, [1, 0]), g("2026-10-04", "c", true, null)];
  assert.deepEqual(byesOf(games, weeks).map((w) => w.label), ["Week 2"]);
});

test("the strip: a bar a game in date order, margins, the bye in its place, the playoffs' first game marked", () => {
  const games = [g("2026-09-13", "a", true, [24, 17]), g("2026-09-27", "b", false, [10, 31]), g("2026-10-04", "c", true, null), g("2026-10-11", "d", true, null, { stage: "post" }), g("2026-10-01", "x", true, null, { off: true })];
  const s = stripOf(games, [{ label: "Week 2", from: "2026-09-15", to: "2026-09-21" }]);
  assert.deepEqual(s.map((i) => (i.kind === "bye" ? "bye" : `${i.result ?? "-"}${i.margin}${i.playoffStart ? "P" : ""}`)), ["W7", "bye", "L21", "-0", "-0P"]);
  assert.equal(stripWords(s, "Lost 1"), "2 played: 1 won, 1 lost; biggest win by 7; lost the last 1; 2 to come");
});

test("a daily sport's runs: three or more at home or away in a row", () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-04", "2026-11-05", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-11"];
  const homes = [true, true, true, false, false, false, false, true];
  const runs = runsOf(days.map((d, i) => g(d, "o", homes[i], null, { id: `r${i}` })));
  assert.deepEqual(runs.map((r) => [r.home, r.games.length]), [[true, 3], [false, 4]]);
});

test("a series: consecutive games against one opponent", () => {
  const games = [g("2026-05-01", "bos", true, null, { id: "s1" }), g("2026-05-02", "bos", true, null, { id: "s2" }), g("2026-05-03", "bos", true, null, { id: "s3" }), g("2026-05-05", "tor", false, null, { id: "s4" })];
  const p = seriesPlaces(games);
  assert.deepEqual(p.get("s2"), { i: 2, n: 3 });
  assert.equal(p.get("s4"), undefined);
});

test("the schedule opens on the next game's month, else the last month played", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  assert.equal(focusMonth([g("2026-10-04", "a", true, [1, 0]), g("2026-12-01", "b", true, null)], now), "2026-12");
  assert.equal(focusMonth([g("2026-09-04", "a", true, [1, 0]), g("2026-10-04", "b", true, [1, 0])], now), "2026-10");
});

test("ordinals", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st"]);
});
