// Fill in who's playing (src/lib/server/rosters.ts, db/migrations/0144): one question for any sport (teams, their people and
// coaches, the officials; a sport of individuals one "Field"), the listing's titles as context, and an answer read by its shape
// alone: groups of people with roles, fenced JSON or not, nobody twice. Saving (only a sport nobody's made a game of, with no cast)
// is checked against the database by scripts/dev-test/check-show-words.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readRoster, rosterPrompt } = jiti("../src/lib/server/rosters.ts");
const { showWords } = jiti("../src/lib/game/show-words.ts");

const season = (people, titles = []) => ({ show: "World Series", seasonLabel: "season 2026", kind: "sport", ready: false, words: showWords({ castaway: people, episode: "Game" }), titles, people: 0 });

test("the question: the same for every sport, in the show's own words, with its listing's titles", () => {
  const p = rosterPrompt(season("Player", ["Game 1: Tampa Bay Rays at Milwaukee Brewers"]));
  assert.match(p, /who's taking part in World Series \(season 2026\)/);
  assert.match(p, /One group per team, with its players on the current roster and nobody else \(no coaches, staff or officials\)/);
  assert.doesNotMatch(p, /"Officials"/);
  assert.match(p, /one group named "Field"/);
  assert.match(p, /- Game 1: Tampa Bay Rays at Milwaukee Brewers/);
  assert.match(rosterPrompt(season("Driver")), /with its drivers on the current roster/);
  assert.doesNotMatch(rosterPrompt(season("Player")), /TV listings for it/);
});

test("an answer read by its shape: groups, people, roles; fenced or not; nobody twice; empty groups dropped", () => {
  const answer = 'Sure!\n```json\n{"groups":[{"name":"Rays","people":[{"name":" Kevin  Cash ","role":"Manager"},{"name":"Yandy Díaz"}]},{"name":"Brewers","people":[{"name":"kevin cash","role":"Pitcher"},{"role":"no name"}]},{"name":"Empty","people":[]}]}\n```';
  assert.deepEqual(readRoster(answer), [
    { name: "Rays", people: [{ name: "Kevin Cash", role: "Manager", photoUrl: null }, { name: "Yandy Díaz", role: null, photoUrl: null }] },
  ]);
  assert.deepEqual(readRoster("nothing here"), []);
  assert.deepEqual(readRoster('{"groups":"no"}'), []);
});

const { statsPrompt, readStats, pendingStats } = jiti("../src/lib/server/rosters.ts");
const people = [{ name: "Aaron Ashby", group: "Milwaukee Brewers", role: "Pitcher" }, { name: "Pat Murphy", group: "Milwaukee Brewers", role: "Manager" }];

test("the stats question: coming in, so far through the latest one played, the sport's own columns; one part alone", () => {
  const both = statsPrompt(season("Player"), people, { number: 3, title: "Game 3: Brewers at Rays" });
  assert.match(both, /"comingIn": \{"label"/);
  assert.match(both, /"soFar": \{"through": 3/);
  assert.match(both, /through Game 3 \("Game 3: Brewers at Rays"\), the latest one played/);
  assert.match(both, /the columns this sport's box scores and stat sheets use/);
  assert.match(both, /- Aaron Ashby \(Milwaukee Brewers, Pitcher\)/);
  const soFar = statsPrompt(season("Player"), people, { number: 3, title: null }, ["soFar"]);
  assert.doesNotMatch(soFar, /comingIn/);
  const before = statsPrompt(season("Player"), people, null);
  assert.doesNotMatch(before, /"soFar": {/);
  assert.match(before, /Nothing has been played yet/);
});

test("a stats answer read by its shape: roster names only, a handful of columns, so far never past what's ended", () => {
  const answer = JSON.stringify({
    comingIn: { label: "2026 regular season", people: [{ name: "aaron ashby", stats: [{ label: "ERA", value: 3.12 }, { label: "SO", value: "116" }] }, { name: "Not On The Roster", stats: [{ label: "X", value: "1" }] }] },
    soFar: { through: 9, people: [{ name: "Aaron Ashby", stats: [{ label: "IP", value: "1.2" }] }, { name: "Pat Murphy", stats: [] }] },
  });
  const read = readStats(answer, ["Aaron Ashby", "Pat Murphy"], 3);
  assert.equal(read.comingIn.label, "2026 regular season");
  assert.deepEqual([...read.comingIn.people], [["Aaron Ashby", [{ label: "ERA", value: "3.12" }, { label: "SO", value: "116" }]]]);
  assert.equal(read.soFar.through, 3, "a 'through' past what's ended is the latest that has");
  assert.deepEqual([...read.soFar.people.keys()], ["Aaron Ashby"]);
  assert.equal(readStats(answer, ["Aaron Ashby"], 0).soFar, null, "nothing's ended: no so far");
});

test("who's still to be asked about: so far for the latest ended first, then coming in; missed twice counts as asked", () => {
  const names = ["A", "B", "C"];
  assert.deepEqual(pendingStats(names, [], 3), [{ part: "soFar", through: 3, names }, { part: "comingIn", through: 0, names }]);
  const rows = [{ name: "a", through: 3 }, { name: "B", through: 3, misses: 2 }, { name: "C", through: 3 }, { name: "A", through: 0 }];
  assert.deepEqual(pendingStats(names, rows, 3), [{ part: "comingIn", through: 0, names: ["B", "C"] }]);
  // Left out of an answer once: asked again (a long answer drops people); twice: that's final.
  assert.deepEqual(pendingStats(names, [...rows, { name: "B", through: 0, misses: 1 }, { name: "C", through: 0, misses: 2 }], 3), [{ part: "comingIn", through: 0, names: ["B"] }]);
  assert.deepEqual(pendingStats(names, rows, 4)[0], { part: "soFar", through: 4, names }, "a newer game ended: everyone again, for it");
  assert.deepEqual(pendingStats(names, [], null), [{ part: "comingIn", through: 0, names }]);
});
