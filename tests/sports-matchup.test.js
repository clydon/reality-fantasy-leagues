// Games straight from a team's schedule as a matchup (docs/PLAN-start-a-game-gpt.md track L, L1 part 3): ESPN's schedule and lines
// read (src/lib/server/sports/espn.ts readScoreboard, readOdds, readBoxScore's pickcenter; cache.ts keepSchedule), the games a
// matchup means picked from a schedule, its key, name and status, a game's facts and what its final settles
// (src/lib/sports/matchup.ts), and the user's 76ers example made from the 76ers' real schedule (tests/fixtures/espn/
// nba-schedule-20.json, recorded 2026-10-28) settling as typed. Making its season in the database is
// scripts/dev-test/check-matchup.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readScoreboard, readOdds, readBoxScore } = jiti("../src/lib/server/sports/espn.ts");
const { keepSchedule } = jiti("../src/lib/server/sports/cache.ts");
const { pickMatchup, matchupKey, matchupName, matchupStatus, leagueName, factsOf, finalOf } = jiti("../src/lib/sports/matchup.ts");
const examples = require("./fixtures/sports-examples");

const schedule = require("./fixtures/espn/nba-schedule-20.json");
const PHI = "20";
const games = readScoreboard("basketball/nba", schedule).sort((a, b) => a.at.localeCompare(b.at));

test("a team's schedule reads as a scoreboard's games: the stage from its seasonType, scores from { value, displayValue }", () => {
  assert.equal(games.length, 80);
  assert.ok(games.every((g) => g.stage === "regular" && g.competitors.some((c) => c.team.id === PHI)));
  const opener = games.find((g) => g.id === "401909093");
  assert.equal(opener.name, "Cleveland Cavaliers at Philadelphia 76ers");
  assert.deepEqual([opener.state, opener.final, opener.at, opener.odds], ["post", true, "2026-10-22T23:00Z", null]);
  assert.deepEqual(
    opener.competitors.map((c) => [c.team.id, c.team.also[0], c.home, c.score, c.winner]),
    [
      ["20", "76ers", true, "114", true],
      ["5", "Cavaliers", false, "106", false],
    ]
  );
  // Games still to play: no score yet.
  const coming = games.find((g) => g.state === "pre");
  assert.ok(coming.competitors.every((c) => c.score === null && c.winner === null));
});

test("a line: a scoreboard's before the game, a summary's pickcenter after; nothing said is null", () => {
  // ESPN's scoreboard for 2026-10-28, Heat at Hawks before tip-off (trimmed): DraftKings.
  const [e] = readScoreboard("basketball/nba", {
    events: [
      {
        id: "401909881",
        date: "2026-10-28T23:00Z",
        name: "Miami Heat at Atlanta Hawks",
        status: { type: { state: "pre", completed: false } },
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { id: "1", displayName: "Atlanta Hawks" } },
              { homeAway: "away", team: { id: "14", displayName: "Miami Heat" } },
            ],
            odds: [{ provider: { id: "100", name: "DraftKings", displayName: "DraftKings" }, details: "ATL -1.5", overUnder: 241.5, spread: -1.5 }],
          },
        ],
      },
    ],
  });
  assert.deepEqual(e.odds, { provider: "DraftKings", details: "ATL -1.5", overUnder: 241.5, spread: -1.5 });
  // The recorded 76ers opener's summary keeps the line after the game.
  const summary = require(`./fixtures/${examples.sixersOpener.recorded[0]}`);
  assert.deepEqual(readBoxScore(summary).odds, { provider: "DraftKings", details: "PHI -2.5", overUnder: 237.5, spread: -2.5 });
  assert.equal(readOdds(undefined), null);
  assert.equal(readOdds({ provider: { name: "DraftKings" } }), null);
  assert.deepEqual(readOdds({ details: "EVEN", overUnder: "8.5" }), { provider: null, details: "EVEN", overUnder: 8.5, spread: null });
});

test("the games a matchup means, from the 76ers' schedule: the home opener, the opener, the next few, against one team", () => {
  assert.deepEqual(pickMatchup(PHI, games, { kind: "opener", home: true }).map((g) => g.id), ["401909093"]);
  assert.deepEqual(pickMatchup(PHI, games, { kind: "opener" }).map((g) => g.id), ["401909089"], "the season opened at the Knicks");
  const next = pickMatchup(PHI, games, { kind: "next", count: 3 });
  const firstToPlay = games.findIndex((g) => g.state !== "post");
  assert.deepEqual(next.map((g) => g.id), games.slice(firstToPlay, firstToPlay + 3).map((g) => g.id));
  const knicks = pickMatchup(PHI, games, { kind: "next", count: 2, against: "18" });
  assert.equal(knicks.length, 2);
  assert.ok(knicks.every((g) => g.state !== "post" && g.competitors.some((c) => c.team.id === "18")));
  assert.deepEqual(pickMatchup(PHI, games, { kind: "games", events: ["401909855", "401909093", "nope"] }).map((g) => g.id), ["401909093", "401909855"], "in the schedule's order");
  assert.deepEqual(pickMatchup("999", games, { kind: "opener" }), [], "a team not in it");
});

// A made-up schedule for a series: the Red Sox (2) at the Yankees (10) three nights running, one played already, then the Rays
// (30), then the Red Sox again a month on.
const game = (id, at, home, away, state = "pre") => ({ id, name: `${away} at ${home}`, at, state, final: state === "post", stage: "regular", competitors: [{ team: { id: home, name: home === "10" ? "New York Yankees" : home === "2" ? "Boston Red Sox" : "Tampa Bay Rays", also: [home === "10" ? "Yankees" : home === "2" ? "Red Sox" : "Rays"] }, home: true, score: null, winner: null }, { team: { id: away, name: away === "10" ? "New York Yankees" : away === "2" ? "Boston Red Sox" : "Tampa Bay Rays", also: [away === "10" ? "Yankees" : away === "2" ? "Red Sox" : "Rays"] }, home: false, score: null, winner: null }] });
const series = [
  game("a", "2026-09-29T23:05Z", "10", "2", "post"),
  game("b", "2026-09-30T23:05Z", "10", "2"),
  game("c", "2026-10-01T23:05Z", "10", "2"),
  game("d", "2026-10-02T23:05Z", "10", "30"),
  game("e", "2026-11-01T23:05Z", "2", "10"),
];

test("a series: the whole run of games in a row the next one's in, never another run weeks on", () => {
  assert.deepEqual(pickMatchup("10", series, { kind: "series", against: "2" }).map((g) => g.id), ["a", "b", "c"], "asked mid-series: all of it");
  const played = series.map((g) => (["a", "b", "c"].includes(g.id) ? { ...g, state: "post", final: true } : g));
  assert.deepEqual(pickMatchup("10", played, { kind: "series", against: "2" }).map((g) => g.id), ["e"], "once it's over, the next one");
  assert.deepEqual(pickMatchup("10", series, { kind: "series", against: "99" }), []);
  // A postseason series is its games in a row, however many days off between them (four days here); a regular season's isn't.
  const final = [game("f1", "2026-06-06T00:30Z", "10", "2"), game("f2", "2026-06-10T00:30Z", "2", "10"), game("f3", "2026-06-12T00:30Z", "2", "10")];
  assert.deepEqual(pickMatchup("10", final.map((g) => ({ ...g, stage: "post" })), { kind: "series", against: "2" }).map((g) => g.id), ["f1", "f2", "f3"]);
  assert.deepEqual(pickMatchup("10", final, { kind: "series", against: "2" }).map((g) => g.id), ["f1"]);
});

test("a matchup's key (its games, in any order), its name and its status", () => {
  assert.equal(matchupKey("espn", "basketball/nba", ["401909093"]), "espn:basketball/nba:401909093");
  assert.equal(matchupKey("espn", "baseball/mlb", ["c", "a", "b", "a"]), matchupKey("espn", "baseball/mlb", ["a", "b", "c"]));
  const opener = games.filter((g) => g.id === "401909093");
  assert.equal(matchupName(opener, PHI), "Cavaliers at 76ers, Oct 22");
  assert.equal(matchupName(series.slice(0, 3), "10"), "Red Sox at Yankees, Sep 29 – Oct 1");
  assert.equal(matchupName([series[0], series[4]], "10"), "Yankees vs Red Sox, Sep 29 – Nov 1");
  assert.equal(matchupName(series.slice(2, 4), "10"), "Yankees, 2 games, Oct 1 – Oct 2");
  const now = Date.parse("2026-09-30T00:00Z");
  assert.equal(matchupStatus(series.slice(1, 3), now), "upcoming");
  assert.equal(matchupStatus(series.slice(0, 3), now), "airing");
  assert.equal(matchupStatus(series.slice(0, 1), now), "completed");
  // ESPN's own name when its answer says (a scoreboard's league, a soccer schedule's events'): what people call it.
  assert.equal(leagueName("soccer/eng.1", { name: "English Premier League", short: "Premier League" }), "Premier League");
  assert.equal(leagueName("basketball/nba", { name: "National Basketball Association", short: "NBA" }), "NBA");
  assert.equal(leagueName("soccer/ger.dfb_pokal", { name: "German Cup", short: null }), "German Cup");
  assert.equal(leagueName("soccer/mex.1", { name: "Mexican Liga BBVA MX", short: "Liga MX" }), "Liga MX");
  // Not a code nobody says: college's are its full name.
  assert.equal(leagueName("basketball/mens-college-basketball", { name: "NCAA Men's Basketball", short: "NCAAM" }), "NCAA Men's Basketball");
  assert.equal(leagueName("football/college-football", { name: "NCAA - Football", short: "NCAAF" }), "NCAA Football");
  // Else its slug, as people write it.
  assert.deepEqual(["basketball/nba", "baseball/mlb", "basketball/wnba", "basketball/mens-college-basketball", "soccer/eng.1"].map((l) => leagueName(l)), ["NBA", "MLB", "WNBA", "Mens College Basketball", "Eng 1"]);
});

test("how long the cache keeps a team's schedule: a game on, a game within the day, else half a day", () => {
  const now = Date.parse("2026-10-28T12:00Z");
  assert.equal(keepSchedule(games.map((g, i) => (i === 3 ? { ...g, state: "in" } : g)), now), 3 * 60_000);
  assert.equal(keepSchedule(games, now), 3600_000, "the 76ers play at 23:00 today");
  assert.equal(keepSchedule(games, Date.parse("2026-10-10T12:00Z")), 12 * 3600_000);
  assert.equal(keepSchedule(null, now), 12 * 3600_000);
});

test("the Red Sox–Yankees example made from the schedule: the Yankees' postseason, the series against the Red Sox as of the day before", () => {
  const ex = examples.redSoxYankees;
  const recorded = require("./fixtures/espn/mlb-schedule-10-2026-3.json");
  const post = readScoreboard(ex.league, recorded);
  assert.ok(post.every((g) => g.stage === "post"), "the postseason (seasontype 3)");
  const picked = pickMatchup(ex.matchup.team, post, ex.matchup.ask);
  assert.deepEqual(picked.map((g) => g.id), ex.games, "the Wild Card Series, both games, not the Division Series after");
  assert.equal(matchupName(picked, ex.matchup.team), "Red Sox at Yankees, Sep 29 – Sep 30");
  // Asked once it's all played, without a moment: nothing still to play against them.
  assert.deepEqual(pickMatchup(ex.matchup.team, post, { kind: "series", against: "2" }), []);
});

test("the 76ers example made from the schedule: the home opener, its final and ESPN's line kept, settling as typed", () => {
  const ex = examples.sixersOpener;
  const [opener] = pickMatchup(ex.matchup.team, games, ex.matchup.ask);
  assert.deepEqual([opener.id], ex.games, "the home opener is the example's game");
  assert.deepEqual(new Set(opener.competitors.map((c) => c.team.id)), new Set(ex.spec.pool.where.teams));
  assert.equal(matchupKey("espn", ex.league, [opener.id]), "espn:basketball/nba:401909093");
  // Made after the game: its line from its summary (ESPN's pickcenter), as the season's maker does.
  const summary = require(`./fixtures/${ex.recorded[0]}`);
  const facts = factsOf({ ...opener, odds: readBoxScore(summary).odds });
  assert.deepEqual(
    facts.sides.map((s) => [s.id, s.home, s.score, s.winner]),
    [
      ["20", true, 114, true],
      ["5", false, 106, false],
    ]
  );
  assert.equal(facts.final, true);
  assert.deepEqual({ provider: facts.odds.provider, details: facts.odds.details, overUnder: facts.odds.overUnder }, ex.line);
  assert.equal(ex.spec.ask.find((q) => q.id === "total").line, facts.odds.overUnder, "the spec's line is the one kept");
  // The schedule's final is the summary's.
  assert.deepEqual(
    Object.fromEntries(facts.sides.map((s) => [s.id, s.score])),
    Object.fromEntries(summary.header.competitions[0].competitors.map((c) => [c.team.id, Number(c.score)]))
  );
  // What its final settles: "Who wins?" and "Total points: over or under?" (the top scorer is the box score's:
  // tests/sports-basketball.test.js).
  const settled = finalOf(facts, facts.odds.overUnder);
  assert.deepEqual({ winner: settled.winner, score: settled.score, total: settled.total, overUnder: settled.overUnder }, { winner: ex.settles.winner, score: ex.settles.score, total: ex.settles.total, overUnder: ex.settles.overUnder });
  // Before it's final, a final settles nothing; a push is a push.
  assert.equal(finalOf({ ...facts, final: false }), null);
  assert.equal(finalOf(facts, 220).overUnder, "push");
});
