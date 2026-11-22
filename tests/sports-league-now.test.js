// Where a league's season is today, for its card in Your shows (src/lib/sports/league-now.ts; docs/PLAN-sports-couch.md A2):
// football's own weeks and their playoff names, a daily sport's Monday-to-Sunday weeks and "Playoffs", a soccer league's rounds
// (no week: they need fixtures), the days between two stages still on, and the off-season with when it's back.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { nowOf } = jiti("../src/lib/sports/league-now.ts");

// ESPN's instants: a stage or a week runs from 08:00Z on its first day to 07:59Z after its last (the East's days).
const day = (d) => `${d}T08:00Z`;
const nfl = {
  season: 2026,
  label: "2026",
  now: 2,
  stages: [
    { stage: "regular", type: 2, name: "Regular Season", from: day("2026-09-09"), to: day("2027-01-06") },
    { stage: "post", type: 3, name: "Postseason", from: day("2027-01-06"), to: day("2027-02-10") },
  ],
  days: [],
  weeks: [
    { type: 2, label: "Week 11", detail: null, from: day("2026-11-17"), to: day("2026-11-24") },
    { type: 2, label: "Week 12", detail: null, from: day("2026-11-24"), to: day("2026-12-01") },
    { type: 3, label: "Wild Card", detail: null, from: day("2027-01-06"), to: day("2027-01-13") },
  ],
  leagueName: { name: "National Football League", short: "NFL" },
};
const nba = {
  season: 2027,
  label: "2026-27",
  now: 2,
  stages: [
    { stage: "regular", type: 2, name: "Regular Season", from: day("2026-10-20"), to: day("2027-04-12") },
    { stage: "post", type: 3, name: "Postseason", from: day("2027-04-18"), to: day("2027-06-20") },
  ],
  days: ["2026-10-20", "2026-10-21", "2026-10-27", "2026-11-03", "2026-11-17", "2026-11-22", "2027-04-20"],
  weeks: [],
  leagueName: { name: "National Basketball Association", short: "NBA" },
};

test("football says its own week, and the playoffs' name", () => {
  const n = nowOf("football/nfl", nfl, "week", "2026-11-22");
  assert.deepEqual([n.leagueName, n.on, n.stage, n.week, n.back, n.season], ["NFL", true, "regular", "Week 11", null, "2026"]);
  assert.equal(nowOf("football/nfl", nfl, "week", "2027-01-08").week, "Wild Card");
});

test("a daily sport counts Monday-to-Sunday weeks, and calls its playoffs Playoffs", () => {
  // Its days: Oct 20 (week 1), Oct 27 (2), Nov 3 (3), Nov 17 (4), Nov 22 (still 4: the week of Nov 16).
  assert.equal(nowOf("basketball/nba", nba, "week", "2026-11-22").week, "Week 4");
  assert.equal(nowOf("basketball/nba", nba, "week", "2027-04-20").week, "Playoffs");
});

test("the days between the regular season and the playoffs are still on", () => {
  const n = nowOf("basketball/nba", nba, "week", "2027-04-15");
  assert.equal(n.on, true);
  assert.equal(n.back, null);
});

test("a week's days, for a league's page to read (B1): football's as the calendar cuts it, a daily sport's Monday to Sunday", () => {
  const n = nowOf("football/nfl", nfl, "week", "2026-11-22");
  assert.deepEqual([n.from, n.to], ["2026-11-17", "2026-11-23"]);
  const b = nowOf("basketball/nba", nba, "week", "2026-11-22");
  assert.deepEqual([b.from, b.to], ["2026-11-16", "2026-11-22"]);
  const off = nowOf("basketball/nba", nba, "week", "2026-09-30");
  assert.deepEqual([off.from, off.to], [null, null]);
});

test("off-season: not on, no week, and when it's back when the calendar lists it", () => {
  const before = nowOf("basketball/nba", nba, "week", "2026-09-30");
  assert.deepEqual([before.on, before.stage, before.week, before.back], [false, null, null, "2026-10-20"]);
  const after = nowOf("basketball/nba", nba, "week", "2027-07-01");
  assert.deepEqual([after.on, after.back], [false, null]);
});

test("a league cut by rounds has no week to say", () => {
  const epl = { ...nba, label: "2026-27 English Premier League", stages: [{ stage: null, type: 14308, name: "Season", from: day("2026-08-15"), to: day("2027-05-24") }], leagueName: { name: "English Premier League", short: "EPL" } };
  const n = nowOf("soccer/eng.1", epl, "round", "2026-11-22");
  assert.deepEqual([n.on, n.week, n.season], [true, null, "2026-27"]);
});
