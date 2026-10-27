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
  assert.match(p, /One group per team, with its players on the current roster/);
  assert.match(p, /group named "Officials"/);
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
