// Finding a game (docs/PLAN-start-a-game-gpt.md track L, L7): ESPN's team lists read (src/lib/server/sports/espn.ts readTeams), a
// team found by the words people type and two teams in any order as a matchup (src/lib/sports/teams.ts findTeams), a team's
// schedule as the screens show it (scheduleOf: its games from its side, its series, its meetings with one opponent, games called
// off), a team's season's name and key, on ESPN's real lists and schedules (tests/fixtures/espn/*-teams.json and the Eagles' and
// Yankees' schedules, recorded 2026-11-06). Making the seasons in the database, the stand-in ESPN's search and the routes' server
// side is scripts/dev-test/check-find-game.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readTeams, readScoreboard } = jiti("../src/lib/server/sports/espn.ts");
const { findTeams, findLeagues, teamScore, wordsOf, scheduleOf, seasonName, FITS } = jiti("../src/lib/sports/teams.ts");
const { seasonKey, matchupKey, MAX_SEASON } = jiti("../src/lib/sports/matchup.ts");
const { allSports } = jiti("../src/lib/sports/index.ts");
const { teamLeagues, searchTeams } = jiti("../src/lib/server/sports/find.ts");

const LEAGUES = [
  ["football/nfl", "nfl"],
  ["baseball/mlb", "mlb"],
  ["basketball/nba", "nba"],
  ["hockey/nhl", "nhl"],
  ["football/college-football", "college-football"],
  ["basketball/mens-college-basketball", "mens-college-basketball"],
];
const lists = LEAGUES.map(([league, file]) => readTeams(league, require(`./fixtures/espn/${file}-teams.json`)));
const find = (q) => findTeams(lists, q);
const names = (hits) => hits.map((t) => `${t.name} (${t.leagueName})`);

test("a league's team list: every active team with its names, logo and colour, and the league's names", () => {
  const nfl = lists[0];
  assert.equal(nfl.league, "football/nfl");
  assert.deepEqual(nfl.name, { name: "National Football League", short: "NFL" });
  assert.equal(nfl.teams.length, 32);
  const phi = nfl.teams.find((t) => t.id === "21");
  assert.deepEqual(phi, { id: "21", name: "Philadelphia Eagles", also: ["Eagles", "Philadelphia"], abbreviation: "PHI", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png", color: "06424d" });
  assert.deepEqual(lists.map((l) => l.teams.length), [32, 30, 30, 32, 762, 362]);
  // An inactive team is left out; an answer with no league is none.
  const one = readTeams("x/y", { sports: [{ leagues: [{ name: "Y", teams: [{ team: { id: "1", displayName: "A", isActive: false } }, { team: { id: "2", displayName: "B" } }] }] }] });
  assert.deepEqual(one.teams.map((t) => t.id), ["2"]);
  assert.equal(readTeams("x/y", { sports: [] }), null);
  assert.equal(readTeams("x/y", null), null);
});

test("the leagues searched are the team sports' own", () => {
  assert.deepEqual(teamLeagues().sort(), [
    "baseball/college-baseball",
    "baseball/mlb",
    "basketball/mens-college-basketball",
    "basketball/nba",
    "basketball/wnba",
    "basketball/womens-college-basketball",
    "football/college-football",
    "football/nfl",
    "hockey/nhl",
  ]);
});

test("a team by the words people type: its abbreviation, its name or the start of one, a plural people say", () => {
  assert.equal(wordsOf("N'Western (MN)").join(" "), "nwestern mn");
  assert.equal(wordsOf("Texas A&M").join(" "), "texas am");
  const nyy = lists[1].teams.find((t) => t.id === "10");
  assert.deepEqual(["NYY", "new york yankees", "yankees", "new york y", "york yank", "yanks", "mets"].map((q) => teamScore(wordsOf(q), nyy)), [100, 100, 96, 85, FITS, FITS, 0]);
  assert.deepEqual(names(find("yanks").teams), ["New York Yankees (MLB)"]);
  assert.deepEqual(names(find("NYY").teams), ["New York Yankees (MLB)"]);
  assert.equal(find("new york y").teams[0].name, "New York Yankees");
  assert.equal(find("new york y").matchup, null, "never the Mets against them");
  assert.deepEqual(names(find("76ers").teams), ["Philadelphia 76ers (NBA)"]);
});

test("Eagles: Philadelphia's first, then the college Eagles; Boston College when the words say so", () => {
  const eagles = find("Eagles").teams;
  assert.equal(eagles[0].name, "Philadelphia Eagles");
  assert.equal(eagles[0].college, false);
  assert.ok(eagles.slice(1).every((t) => t.college && / Eagles$/.test(t.name)));
  // A school in both college leagues before one in only one.
  assert.ok(["Boston College Eagles", "Eastern Michigan Eagles", "Eastern Washington Eagles"].includes(eagles[1].name), eagles[1].name);
  assert.equal(eagles.length, 12);
  // Each league named as its show is ("NCAA Football", never "NCAAF").
  assert.deepEqual(names(find("boston college").teams), ["Boston College Eagles (NCAA Football)", "Boston College Eagles (NCAA Men's Basketball)"]);
  // The start of a name: every Philadelphia team, pro first.
  assert.deepEqual(names(find("phil").teams.slice(0, 4)), ["Philadelphia Eagles (NFL)", "Philadelphia Phillies (MLB)", "Philadelphia 76ers (NBA)", "Philadelphia Flyers (NHL)"]);
});

test("two teams in any order: one matchup in their league, at home where the words say", () => {
  const ce = find("cowboys eagles");
  assert.deepEqual(names(ce.matchup.teams), ["Dallas Cowboys (NFL)", "Philadelphia Eagles (NFL)"]);
  assert.equal(ce.matchup.home, null);
  assert.deepEqual(names(ce.teams), names(ce.matchup.teams), "the matchup's teams are the teams found");
  const at = find("eagles at cowboys");
  assert.deepEqual([at.matchup.league, at.matchup.teams.map((t) => t.id), at.matchup.home], ["football/nfl", ["21", "6"], "6"]);
  assert.equal(find("Red Sox @ Yankees").matchup.home, "10");
  assert.deepEqual(names(find("yankees red sox").matchup.teams), ["New York Yankees (MLB)", "Boston Red Sox (MLB)"]);
  assert.deepEqual(names(find("knicks vs nets").matchup.teams), ["New York Knicks (NBA)", "Brooklyn Nets (NBA)"]);
  // One team's name is never two teams: the Red Sox, not Red Wings against White Sox.
  assert.equal(find("red sox").matchup, null);
  assert.deepEqual(names(find("red sox").teams), ["Boston Red Sox (MLB)"]);
  // Two teams of different leagues are no matchup.
  assert.equal(find("yankees eagles").matchup, null);
  // A one-letter side names no one.
  assert.equal(find("man u").matchup, null);
  // Nothing found: nothing (the server asks ESPN's own search then).
  assert.deepEqual(find("sixers"), { teams: [], matchup: null });
});

const eagles = readScoreboard("football/nfl", require("./fixtures/espn/nfl-schedule-21.json"));
const yankees = readScoreboard("baseball/mlb", require("./fixtures/espn/mlb-schedule-10-2026-2.json"));

test("a team's schedule: each game from its side, how it went, and the next to play", () => {
  const v = scheduleOf("21", eagles);
  assert.equal(v.games.length, 17);
  assert.equal(v.series.length, 17, "the NFL plays no series: a game each");
  const first = v.games[0];
  assert.deepEqual([first.home, first.opponent.short, first.result, first.score, first.final], [true, "Commanders", first.score[0] > first.score[1] ? "W" : "L", first.score, true]);
  assert.equal(v.next, "401873044");
  const next = v.games.find((g) => g.id === v.next);
  assert.deepEqual([next.at, next.home, next.opponent.name, next.score, next.result], ["2026-11-08T18:00Z", true, "New York Giants", null, null]);
  // Their meetings with the Cowboys: at home, lost 21-38; at Dallas on Thanksgiving, to come.
  const dal = scheduleOf("21", eagles, { against: "6" });
  assert.deepEqual(
    dal.games.map((g) => [g.at, g.home, g.result, g.score]),
    [
      ["2026-10-27T00:15Z", true, "L", [21, 38]],
      ["2026-11-26T21:30Z", false, null, null],
    ]
  );
  assert.equal(dal.next, dal.games[1].id);
});

test("a baseball season in series: three- and four-game sets, a postponed game in none, their meetings with the Red Sox", () => {
  const v = scheduleOf("10", yankees);
  assert.equal(v.games.length, 165);
  const off = v.games.filter((g) => g.calledOff);
  assert.deepEqual(off.map((g) => [g.id, g.state, g.final, g.result]), [
    ["401815462", "post", false, null],
    ["401815644", "post", false, null],
    ["401816157", "post", false, null],
    ["401816204", "post", false, null],
  ]);
  const sizes = {};
  for (const s of v.series) sizes[s.games.length] = (sizes[s.games.length] ?? 0) + 1;
  assert.deepEqual(sizes, { 2: 3, 3: 41, 4: 8 });
  assert.equal(v.series.reduce((n, s) => n + s.games.length, 0), 161, "every game played, each in one series");
  assert.ok(v.series.every((s) => s.state === "past" && s.home !== undefined));
  assert.deepEqual(v.series[0], { opponent: "26", home: false, games: ["401814702", "401814721", "401814734"], from: "2026-03-26T00:05Z", to: "2026-03-28T23:15Z", state: "past" });
  assert.equal(v.next, null, "the season's over");
  const bos = scheduleOf("10", yankees, { against: "2" });
  assert.equal(bos.games.length, 14);
  assert.deepEqual(bos.series.map((s) => [s.games.length, s.home]), [[3, false], [2, true], [4, false], [4, true]]);
});

test("a team's season's name and key, and a matchup of a season's size", () => {
  assert.equal(seasonName("Eagles", 2026, eagles), "Eagles, 2026 season");
  assert.equal(seasonName("Yankees", 2026, yankees), "Yankees, 2026 season");
  const sixers = readScoreboard("basketball/nba", require("./fixtures/espn/nba-schedule-20.json"));
  assert.equal(seasonName("76ers", 2027, sixers), "76ers, 2026-27 season");
  // A New Year's Eve game at 8 PM in the East is the old year's.
  assert.equal(seasonName("Knicks", 2026, [{ at: "2026-10-01T23:00Z" }, { at: "2027-01-01T01:00Z" }]), "Knicks, 2026 season");
  assert.equal(seasonKey("espn", "baseball/mlb", "10", 2026), "espn:baseball/mlb:season:10:2026");
  assert.ok(seasonKey("espn", "baseball/mlb", "10", 2026).length < matchupKey("espn", "baseball/mlb", yankees.slice(0, 40).map((g) => g.id)).length);
  assert.ok(yankees.length <= MAX_SEASON);
});

test("every team sport says how long its games' broadcasts run", () => {
  const runtimes = Object.fromEntries(allSports().map((s) => [`${s.id}/${(s.leagues ?? ["*"])[0]}`, s.runtime]));
  assert.equal(runtimes["football/nfl"], 195);
  assert.equal(runtimes["football/college-football"], 210);
  assert.equal(runtimes["basketball/nba"], 150);
  assert.equal(runtimes["basketball/mens-college-basketball"], 120);
  assert.equal(runtimes["baseball/mlb"], 180);
  assert.equal(runtimes["hockey/nhl"], 150);
  assert.equal(runtimes["soccer/*"], 120);
});

test("a league by its list's names (L8 part 2): its abbreviation, its show's name, a word of its name in more than one", () => {
  const all = [...lists, readTeams("soccer/eng.1", require("./fixtures/espn/eng.1-teams.json"))];
  const leagues = (q) => findLeagues(all, q).map((l) => `${l.leagueName} ${l.score}`);
  assert.deepEqual(leagues("nfl"), ["NFL 100"]);
  assert.deepEqual(leagues("NBA"), ["NBA 100"]);
  assert.deepEqual(leagues("premier league"), ["Premier League 96"]);
  assert.deepEqual(leagues("English Premier League"), ["Premier League 100"]);
  assert.deepEqual(leagues("national football"), ["NFL 85"]);
  assert.deepEqual(leagues("football"), ["NFL 70", "NCAA Football 70"]);
  assert.deepEqual(leagues("ncaaf"), ["NCAA Football 100"]);
  assert.deepEqual(leagues("mens college basketball"), ["NCAA Men's Basketball 96"]);
  assert.deepEqual(findLeagues(all, "nfl")[0], { league: "football/nfl", leagueName: "NFL", name: "National Football League", score: 100 });
  // A team's name names no league.
  assert.deepEqual(leagues("eagles"), []);
  assert.deepEqual(leagues("yankees red sox"), []);
});

test("a search through ESPN's: its leagues of a sport the app reads, named as their lists name them, and only the teams the words fit", async () => {
  const eng = readTeams("soccer/eng.1", require("./fixtures/espn/eng.1-teams.json"));
  // ESPN's search's answers as read (2026-11-06): "premier league" lists the league's clubs besides its leagues; "mls" the
  // Whitecaps; "sixers" the 76ers and a cricket tour; "f1" Formula 1.
  const answers = {
    "premier league": [
      { kind: "team", id: "360", name: "Manchester United", league: "soccer/eng.1" },
      { kind: "team", id: "364", name: "Liverpool", league: "soccer/eng.1" },
      { kind: "league", id: "soccer/eng.1", name: "English Premier League", league: "soccer/eng.1" },
      { kind: "league", id: "soccer/wal.1", name: "Welsh Premier League", league: "soccer/wal.1" },
      { kind: "league", id: "cricket/8048", name: "Indian Premier League", league: "cricket/8048" },
    ],
    mls: [
      { kind: "team", id: "9727", name: "Vancouver Whitecaps", league: "soccer/usa.1" },
      { kind: "league", id: "soccer/usa.1", name: "MLS", league: "soccer/usa.1" },
    ],
    sixers: [
      { kind: "team", id: "20", name: "Philadelphia 76ers", league: "basketball/nba" },
      { kind: "league", id: "cricket/12298", name: "Sydney Sixers tour of South Africa 2012/13", league: "cricket/12298" },
    ],
    // Made up: a nickname's answer with a league of a sport the app reads besides.
    "sixers soccer": [
      { kind: "team", id: "20", name: "Philadelphia 76ers", league: "basketball/nba" },
      { kind: "league", id: "soccer/aus.1", name: "A-League Men", league: "soccer/aus.1" },
    ],
    f1: [{ kind: "league", id: "racing/f1", name: "Formula 1", league: "racing/f1" }],
  };
  const provider = {
    id: "espn",
    find: async (q) => answers[q] ?? [],
    teams: async (league) => (league === "soccer/eng.1" ? eng : league === "basketball/nba" ? lists[2] : null),
    schedule: async () => null,
  };
  const search = (q) => searchTeams(q, { providers: [provider], leagues: ["basketball/nba"] });
  const pl = await search("premier league");
  assert.deepEqual(pl.leagues.map((l) => [l.league, l.leagueName, l.name, l.slate]), [
    ["soccer/eng.1", "Premier League", "English Premier League", true],
    ["soccer/wal.1", "Welsh Premier League", "Welsh Premier League", true],
  ]);
  assert.deepEqual(pl.teams, []);
  const mls = await search("mls");
  assert.deepEqual([mls.leagues.map((l) => l.leagueName), mls.teams.length], [["MLS"], 0]);
  // No league of a sport the app reads: ESPN's teams as found (a name the lists don't have); with one, a team of another league
  // still kept (only a found league's own clubs are left out when the words don't fit them).
  const sixers = await search("sixers");
  assert.deepEqual([sixers.leagues, sixers.teams.map((t) => t.name)], [[], ["Philadelphia 76ers"]]);
  const besides = await search("sixers soccer");
  assert.deepEqual([besides.leagues.map((l) => l.leagueName), besides.teams.map((t) => t.name)], [["A-League Men"], ["Philadelphia 76ers"]]);
  const f1 = await search("f1");
  assert.deepEqual(f1.leagues.map((l) => [l.leagueName, l.slate]), [["Formula 1", false]]);
  // A league a list names: no ESPN search, and a team's name finds no league.
  const nba = await search("nba");
  assert.deepEqual([nba.leagues.map((l) => [l.leagueName, l.slate, l.score]), nba.teams.length], [[["NBA", true, 100]], 0]);
  assert.deepEqual((await search("celtics")).leagues, []);
});
