// A league's art and its season as a ruler (src/lib/sports/league-art.ts; docs/design-round/league-art-spec.md): the art a league
// can wear (its sport's own photo first, then Arena) and the one it wears for you; where its season is along a band's foot
// (football by its weeks, a daily sport by its weeks as its title counts them, soccer by the date, full in the playoffs, nothing
// off-season); the window of a shared art each league shows; and whose art a band wears (yours, else the couch's, else the league's
// own), pictures included.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { artFor, artOf, artInUse, isArtChoice, pictureArt, rulerOf, sportWords, isLeagueKey, LEAGUE_ART, UPLOAD } = jiti("../src/lib/sports/league-art.ts");
const { nowOf } = jiti("../src/lib/sports/league-now.ts");

const ME = { id: "u-me", name: "alex" };
const NFL = "football/nfl";
const state = (o = {}) => ({ mine: {}, pictures: {}, couch: {}, ...o });

test("no one has chosen: the league's own first, nobody's pick", () => {
  assert.deepEqual(artInUse(NFL, state(), ME), { art: artFor(NFL)[0], from: "default", by: null });
  assert.equal(artInUse(NFL, undefined, ME).art.id, "football-night-v1");
});

test("the couch's pick when you haven't chosen (the owner's, worked out by the server), with whose it is", () => {
  const s = state({ couch: { [NFL]: { art: "event-night-v1", by: "u-owner", name: "conor", picture: null } } });
  const r = artInUse(NFL, s, ME);
  assert.deepEqual([r.art.id, r.from, r.by], ["event-night-v1", "couch", { id: "u-owner", name: "conor" }]);
});

test("your own choice wins over the couch's", () => {
  const s = state({ mine: { [NFL]: "football-night-v1" }, couch: { [NFL]: { art: "event-night-v1", by: "u-owner", name: "conor", picture: null } } });
  assert.deepEqual([artInUse(NFL, s, ME).art.id, artInUse(NFL, s, ME).from], ["football-night-v1", "you"]);
});

test("a picture: yours, or the couch owner's, by its versioned link; only while it's there", () => {
  const mine = artInUse(NFL, state({ mine: { [NFL]: UPLOAD }, pictures: { [NFL]: 1700 } }), ME);
  assert.deepEqual([mine.from, mine.art.name, mine.art.src], ["you", "Your picture", "/api/people/u-me/league-art?league=football%2Fnfl&v=1700"]);
  const theirs = artInUse(NFL, state({ couch: { [NFL]: { art: UPLOAD, by: "u-owner", name: "conor", picture: 42 } } }), ME);
  assert.deepEqual([theirs.from, theirs.art.name, theirs.art.id], ["couch", "conor's picture", "upload:u-owner"]);
  // Chosen, but the picture's gone: the couch's, else the league's own.
  assert.equal(artInUse(NFL, state({ mine: { [NFL]: UPLOAD } }), ME).from, "default");
  assert.deepEqual(pictureArt(NFL, "u", 1, "x").position, "50% 50%");
});

test("the couch's pick is yours when you're the one the couch follows", () => {
  const s = state({ couch: { [NFL]: { art: "event-night-v1", by: ME.id, name: ME.name, picture: null } } });
  assert.equal(artInUse(NFL, s, ME).from, "you");
});

test("a choice a league can take: one of its own, or your picture when there is one", () => {
  assert.ok(isArtChoice(NFL, "event-night-v1", false));
  assert.ok(!isArtChoice("baseball/mlb", "football-night-v1", false));
  assert.ok(isArtChoice(NFL, UPLOAD, true));
  assert.ok(!isArtChoice(NFL, UPLOAD, false));
  assert.ok(!isArtChoice(NFL, 7, true));
});

test("a football league wears Under the lights first, then Arena; any other sport Arena alone", () => {
  assert.deepEqual(artFor("football/nfl").map((a) => a.name), ["Under the lights", "Arena"]);
  assert.deepEqual(artFor("football/college-football").map((a) => a.id), ["football-night-v1", "event-night-v1"]);
  assert.deepEqual(artFor("baseball/mlb").map((a) => a.name), ["Arena"]);
  assert.deepEqual(artFor("soccer/eng.1").map((a) => a.name), ["Arena"]);
});

test("the art you chose, while it's still the league's; else its first", () => {
  assert.equal(artOf("football/nfl").id, "football-night-v1");
  assert.equal(artOf("football/nfl", "event-night-v1").id, "event-night-v1");
  assert.equal(artOf("football/nfl", "gone-v9").id, "football-night-v1");
  // A football photo isn't a baseball league's to wear.
  assert.equal(artOf("baseball/mlb", "football-night-v1").id, "event-night-v1");
});

test("every piece of art is one of the app's own generated files", () => {
  for (const a of LEAGUE_ART) assert.match(a.src, /^\/art\/generated\/league\/[a-z0-9-]+\.webp$/);
});

test("a sport as a sentence says it, and a league's key", () => {
  assert.equal(sportWords("baseball/mlb"), "baseball");
  assert.equal(sportWords("mma/ufc"), "MMA");
  assert.ok(isLeagueKey("soccer/eng.1"));
  assert.ok(!isLeagueKey("football"));
  assert.ok(!isLeagueKey("football/nfl'; drop"));
});

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
    { type: 2, label: "Week 1", detail: null, from: day("2026-09-09"), to: day("2026-09-16") },
    { type: 2, label: "Week 12", detail: null, from: day("2026-11-24"), to: day("2026-12-01") },
    { type: 2, label: "Week 18", detail: null, from: day("2026-12-30"), to: day("2027-01-06") },
    { type: 3, label: "Wild Card", detail: null, from: day("2027-01-06"), to: day("2027-01-13") },
  ],
  leagueName: { name: "National Football League", short: "NFL" },
};
const nba = {
  season: 2027,
  label: "2026-27",
  now: 2,
  stages: [
    { stage: "regular", type: 2, name: "Regular Season", from: day("2026-10-20"), to: day("2027-04-13") },
    { stage: "post", type: 3, name: "Postseason", from: day("2027-04-18"), to: day("2027-06-20") },
  ],
  // A game every day, as ESPN's calendar lists a busy league's.
  days: [...every("2026-10-20", "2027-04-12"), ...every("2027-04-18", "2027-06-20")],
  weeks: [],
  leagueName: { name: "National Basketball Association", short: "NBA" },
};
function every(a, b) {
  const out = [];
  for (let t = Date.parse(`${a}T12:00Z`); t <= Date.parse(`${b}T12:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

test("football by its weeks: week 12 of 18, its number under the couch's teams", () => {
  const r = rulerOf(nowOf("football/nfl", nfl, "week", "2026-11-25"), "2026-11-25");
  assert.deepEqual(r, { at: 12 / 18, label: "12", start: "1", end: "18" });
});

test("football's playoffs: the ruler full, the stage named", () => {
  const r = rulerOf(nowOf("football/nfl", nfl, "week", "2027-01-08"), "2027-01-08");
  assert.deepEqual(r, { at: 1, label: "Wild Card", start: "1", end: "18" });
});

test("a daily sport by its weeks, counted as its title counts them: week 6 of 26", () => {
  const now = nowOf("basketball/nba", nba, "day", "2026-11-23");
  assert.equal(now.week, "Week 6");
  assert.deepEqual(now.regular, { from: "2026-10-20", to: "2027-04-13", weeks: 26 });
  assert.deepEqual(rulerOf(now, "2026-11-23"), { at: 6 / 26, label: "6", start: "1", end: "26" });
  // Between the stages (still on): the regular season is over, so now stands at its end, with nothing more to name.
  assert.deepEqual(rulerOf(nowOf("basketball/nba", nba, "day", "2027-04-15"), "2027-04-15"), { at: 1, label: "", start: "1", end: "26" });
  // Its playoffs: full, named.
  assert.deepEqual(rulerOf(nowOf("basketball/nba", nba, "day", "2027-05-01"), "2027-05-01"), { at: 1, label: "Playoffs", start: "1", end: "26" });
});

test("a league with no weeks (soccer's rounds) by the date, from its season's first day to its last, nothing under the teams", () => {
  const epl = { ...nba, label: "2026-27", stages: [{ stage: "regular", type: 1, name: "Season", from: day("2026-08-15"), to: day("2027-05-25") }], days: every("2026-08-15", "2027-05-24") };
  const r = rulerOf(nowOf("soccer/eng.1", epl, "round", "2026-11-23"), "2026-11-23");
  assert.deepEqual([r.label, r.start, r.end], ["", "Aug 15", "May 25"]);
  assert.ok(r.at > 0.34 && r.at < 0.36, `at ${r.at}`);
});

test("two leagues wearing Arena show it through their own windows; each always the same one", () => {
  const windows = new Set(["baseball/mlb", "basketball/nba", "baseball/zt-scm", "basketball/zt-scb", "hockey/nhl"].map((l) => artOf(l).position));
  assert.ok(windows.size > 1, [...windows].join());
  assert.equal(artOf("baseball/mlb").position, artOf("baseball/mlb").position);
  assert.equal(artFor("baseball/mlb")[0].position, artOf("baseball/mlb").position);
});

test("off-season, or a league the app can't place: no ruler", () => {
  assert.equal(rulerOf(nowOf("basketball/nba", nba, "day", "2026-08-01"), "2026-08-01"), null);
  assert.equal(rulerOf(null, "2026-11-23"), null);
  // An older read without the regular season (cached before it was added) places nothing rather than guessing.
  const { regular, ...old } = nowOf("basketball/nba", nba, "day", "2026-11-23");
  assert.ok(regular);
  assert.equal(rulerOf(old, "2026-11-23"), null);
});
