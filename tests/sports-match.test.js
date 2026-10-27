// Which provider event an episode of a sport shows (src/lib/game/sports-match.ts; docs/PLAN-sports-data.md step 2): a title's
// matchup, a team named by any of its names, a field's event by the words it shares with the title, the nearest of equal fits,
// an event's part by when the episode airs, and the days to ask. Linking against a database and a stand-in ESPN is
// scripts/dev-test/check-sports-links.js (and --real for the real World Series). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { wordsOf, matchupOf, sidesOf, named, fitOf, pickEvent, daysFor, NEAR_MS } = jiti("../src/lib/game/sports-match.ts");

const team = (id, name, ...also) => ({ id, name, also });
const RAYS = team("30", "Tampa Bay Rays", "Rays", "Tampa Bay");
const BREWERS = team("8", "Milwaukee Brewers", "Brewers", "Milwaukee");
const METS = team("21", "New York Mets", "Mets", "New York");
const game = (id, at, ...teams) => ({ id, name: `${teams[1]?.name} at ${teams[0]?.name}`, short: null, at, competitors: teams.map((t) => ({ team: t })), parts: [] });
const race = (id, name, at, parts = []) => ({ id, name, short: null, at, competitors: [], parts });
const ep = (title, airAt = "2026-10-24T00:00:00Z") => ({ number: 1, airAt, title });

test("a name's words: lowercase, accents and punctuation gone", () => {
  assert.deepEqual(wordsOf("Brighton & Hove Albion"), ["brighton", "hove", "albion"]);
  assert.deepEqual(wordsOf("Atlético Madrid"), ["atletico", "madrid"]);
  assert.deepEqual(wordsOf("  "), []);
});

test("a title's matchup: the two sides, without its label, brackets or a dash's tail", () => {
  assert.deepEqual(matchupOf("Game 1: Tampa Bay Rays at Milwaukee Brewers"), ["Tampa Bay Rays", "Milwaukee Brewers"]);
  assert.deepEqual(matchupOf("Week 8: Dallas Cowboys vs. Philadelphia Eagles"), ["Dallas Cowboys", "Philadelphia Eagles"]);
  assert.deepEqual(matchupOf("Game 6: Rays @ Brewers (if necessary)"), ["Rays", "Brewers"]);
  assert.deepEqual(matchupOf("Arsenal v Chelsea - Matchweek 9"), ["Arsenal", "Chelsea"]);
  assert.deepEqual(matchupOf("Rays at Brewers: Game 1"), ["Rays", "Brewers"]);
  assert.equal(matchupOf("Game 5"), null);
  assert.equal(matchupOf("United States Grand Prix"), null);
  assert.equal(matchupOf(null), null);
});

test("a season's sides, most often named first, each once however it's spelled", () => {
  const titles = ["Game 1: Tampa Bay Rays at Milwaukee Brewers", "Game 3: Milwaukee Brewers at Tampa Bay Rays", "Game 4: milwaukee brewers at New York Mets", "Game 5", null];
  assert.deepEqual(sidesOf(titles), ["Milwaukee Brewers", "Tampa Bay Rays", "New York Mets"]);
  assert.deepEqual(sidesOf(titles, 1), ["Milwaukee Brewers"]);
});

test("a team is named by any of its names, the longest found counting most", () => {
  assert.equal(named(RAYS, wordsOf("Game 1: Tampa Bay Rays at Milwaukee Brewers")), 3);
  assert.equal(named(RAYS, wordsOf("Rays at Brewers")), 1);
  assert.equal(named(RAYS, wordsOf("Tampa Bay at Milwaukee")), 2);
  assert.equal(named(RAYS, wordsOf("Mets at Brewers")), 0);
  // Whole words only: "Rays" isn't in "Xrays".
  assert.equal(named(RAYS, wordsOf("Xrays at Brewers")), 0);
});

test("a game between teams fits only when the title names every team", () => {
  const g = game("1", "2026-10-24T00:00:00Z", BREWERS, RAYS);
  assert.ok(fitOf(g, "Game 1: Tampa Bay Rays at Milwaukee Brewers") > fitOf(g, "Rays at Brewers"));
  assert.ok(fitOf(g, "Rays at Brewers") > 10);
  assert.equal(fitOf(g, "Game 4: Mets at Brewers"), 0);
  // A title naming no one takes a game between the season's teams, weakly; never another matchup's.
  assert.equal(fitOf(g, "Game 5"), 0);
  assert.equal(fitOf(g, "Game 5", { seasonTeams: new Set(["30", "8"]) }), 1);
  assert.equal(fitOf(game("2", null, METS, RAYS), "Game 5", { seasonTeams: new Set(["30", "8"]) }), 0);
  assert.equal(fitOf(g, "Cubs at Mets", { seasonTeams: new Set(["30", "8"]) }), 0);
});

test("a field's event fits by the telling words it shares with the title, never the show's own name", () => {
  const usgp = race("gp", "MSC Cruises United States Grand Prix", "2026-10-23T17:30Z");
  assert.equal(fitOf(usgp, "United States Grand Prix"), 4);
  assert.equal(fitOf(usgp, "Formula 1: United States Grand Prix", { show: "Formula 1" }), 4);
  assert.equal(fitOf(usgp, "Formula 1: Race 19", { show: "Formula 1" }), 0);
  assert.equal(fitOf(usgp, "Week 3"), 0);
});

test("the event an episode shows: the best fit near its air time, the nearest of equal fits", () => {
  const day = [game("a", "2026-10-23T17:00:00Z", BREWERS, RAYS), game("b", "2026-10-24T00:05:00Z", BREWERS, RAYS), game("c", "2026-10-24T00:00:00Z", METS, RAYS)];
  assert.equal(pickEvent(day, ep("Rays at Brewers")).event.id, "b");
  assert.equal(pickEvent(day, ep("Rays at Mets")).event.id, "c");
  assert.equal(pickEvent(day, ep("Cubs at Mets")), null);
  // Further than NEAR_MS from its air time: not it.
  const far = new Date(Date.parse("2026-10-24T00:00:00Z") + NEAR_MS + 60_000).toISOString();
  assert.equal(pickEvent([game("d", far, BREWERS, RAYS)], ep("Rays at Brewers")), null);
  const mexico = race("mx", "Mexico City Grand Prix", "2026-10-24T18:00Z");
  const usgp = race("us", "MSC Cruises United States Grand Prix", "2026-10-24T18:00Z");
  assert.equal(pickEvent([mexico, usgp], ep("United States Grand Prix")).event.id, "us");
});

test("an event in parts: the part that started last by the time the episode airs", () => {
  const parts = [
    { id: "fp1", name: "FP1", at: "2026-10-23T17:30Z" },
    { id: "qual", name: "Qual", at: "2026-10-24T21:00Z" },
    { id: "race", name: "Race", at: "2026-10-25T20:00Z" },
  ];
  const gp = race("gp", "MSC Cruises United States Grand Prix", "2026-10-23T17:30Z", parts);
  assert.deepEqual({ ...pickEvent([gp], ep("United States Grand Prix", "2026-10-25T19:55:00Z")), event: undefined }, { event: undefined, part: "race", fit: 4 });
  assert.equal(pickEvent([gp], ep("United States Grand Prix: Qualifying", "2026-10-24T21:00:00Z")).part, "qual");
  // An event's own start can be days before (its first practice): a part near the air time is near enough.
  assert.equal(pickEvent([gp], ep("United States Grand Prix", "2026-10-26T01:00:00Z")).part, "race");
  assert.equal(pickEvent([game("g", "2026-10-24T00:00:00Z", BREWERS, RAYS)], ep("Rays at Brewers")).part, null);
});

test("the days to ask: the day it airs in the East, then the day before and after", () => {
  assert.deepEqual(daysFor("2026-10-24T00:00:00Z"), ["2026-10-23", "2026-10-22", "2026-10-24"]);
  assert.deepEqual(daysFor("2026-09-26T04:30:00Z"), ["2026-09-26", "2026-09-25", "2026-09-27"]);
});
