// ESPN's answers read into the provider shapes (src/lib/server/sports/espn.ts, types.ts; docs/PLAN-sports-data.md step 1), on
// trimmed copies of real answers (2026-10-27): a scoreboard (a game between teams, and an F1 weekend in parts), the stage of its
// season a game is in, search, a roster grouped and flat, a box score in baseball's tables and a soccer match sheet's, season
// lines by year (the regular season only), and how long the cache keeps a day's games (cache.ts). The same calls against the real ESPN are scripts/dev-test/check-sports-data.js. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readScoreboard, readSearch, readRoster, readBoxScore, readSeasonStats, readTeam, sizedHeadshot, stageOf } = jiti("../src/lib/server/sports/espn.ts");
const { keepDay } = jiti("../src/lib/server/sports/cache.ts");

const RAYS = { id: "30", displayName: "Tampa Bay Rays", shortDisplayName: "Rays", name: "Rays", location: "Tampa Bay", abbreviation: "TB", logo: "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png" };
const BREWERS = { id: "8", displayName: "Milwaukee Brewers", shortDisplayName: "Brewers", name: "Brewers", location: "Milwaukee", abbreviation: "MIL" };
const FINAL = { type: { state: "post", completed: true } };
const G1 = {
  id: "401908042",
  date: "2026-10-24T00:00Z",
  name: "Tampa Bay Rays at Milwaukee Brewers",
  shortName: "TB @ MIL",
  season: { year: 2026, type: 3, slug: "post-season" },
  status: FINAL,
  competitions: [
    {
      id: "401908042",
      date: "2026-10-24T00:00Z",
      notes: [{ type: "event", headline: "World Series - Game 1" }],
      competitors: [
        { homeAway: "home", team: BREWERS, score: "3", winner: true },
        { homeAway: "away", team: RAYS, score: "2", winner: false },
      ],
    },
  ],
};

test("a team: its full name, the other names it goes by, never an abbreviation", () => {
  assert.deepEqual(readTeam(RAYS), { id: "30", name: "Tampa Bay Rays", also: ["Rays", "Tampa Bay"], abbreviation: "TB", logo: RAYS.logo });
  // AFL's Fremantle is its own location; soccer's teams often have one name.
  assert.deepEqual(readTeam({ id: 1, displayName: "Fremantle", name: "Dockers", location: "Fremantle" }).also, ["Dockers"]);
});

test("a scoreboard: each game with its teams, scores, winner and note; final from ESPN's status", () => {
  const [e] = readScoreboard("baseball/mlb", { events: [G1, { name: "no id" }] });
  assert.equal(e.id, "401908042");
  assert.equal(e.league, "baseball/mlb");
  assert.equal(e.name, "Tampa Bay Rays at Milwaukee Brewers");
  assert.deepEqual([e.state, e.final, e.season, e.stage, e.note, e.at], ["post", true, 2026, "post", "World Series - Game 1", "2026-10-24T00:00Z"]);
  assert.deepEqual(
    e.competitors.map((c) => [c.team.name, c.home, c.score, c.winner, c.person]),
    [
      ["Milwaukee Brewers", true, "3", true, null],
      ["Tampa Bay Rays", false, "2", false, null],
    ]
  );
  assert.deepEqual(e.parts, []);
  assert.deepEqual(readScoreboard("baseball/mlb", null), []);
});

test("the stage of its season a game is in: ESPN's slug, else its type; a soccer league's own season says none", () => {
  assert.equal(stageOf({ year: 2026, type: 3, slug: "post-season" }), "post");
  assert.equal(stageOf({ year: 2027, type: 2, slug: "regular-season" }), "regular");
  assert.equal(stageOf({ type: 1, slug: "preseason" }), "pre");
  assert.equal(stageOf({ year: 2026, type: 14308, slug: "2026-27-english-premier-league" }), null);
  assert.equal(stageOf({ type: 3 }), "post");
  assert.equal(stageOf(undefined), null);
});

test("an event in parts (an F1 weekend): each part's field and places on the part", () => {
  const driver = (id, name, order) => ({ order, athlete: { id, displayName: name, headshot: { href: `https://a.espncdn.com/${id}.png` } } });
  const [gp] = readScoreboard("racing/f1", {
    events: [
      {
        id: "600057446",
        date: "2026-10-23T17:30Z",
        name: "MSC Cruises United States Grand Prix",
        status: { type: { state: "post", completed: true } },
        competitions: [
          { id: "1", date: "2026-10-23T17:30Z", type: { abbreviation: "FP1" }, status: FINAL, competitors: [driver("4665", "Charles Leclerc", 1)] },
          { id: "5", date: "2026-10-25T20:00Z", type: { abbreviation: "Race" }, status: { type: { state: "in" } }, competitors: [driver("5592", "Kimi Antonelli", 1), driver("4665", "Charles Leclerc", 2)] },
        ],
      },
    ],
  });
  assert.deepEqual(gp.competitors, []);
  assert.deepEqual(gp.parts.map((p) => [p.id, p.name, p.at, p.state]), [["1", "FP1", "2026-10-23T17:30Z", "post"], ["5", "Race", "2026-10-25T20:00Z", "in"]]);
  assert.deepEqual(gp.parts[1].competitors.map((c) => [c.place, c.person.name, c.team]), [[1, "Kimi Antonelli", null], [2, "Charles Leclerc", null]]);
});

test("search: teams (by the id in their uid) and leagues, each with ESPN's league path; the rest left out", () => {
  const found = readSearch({
    results: [
      { type: "team", contents: [{ uid: "s:1~l:10~t:30", displayName: "Tampa Bay Rays", sport: "baseball", defaultLeagueSlug: "mlb" }, { uid: "s:200~t:172", displayName: "WSC World XI" }] },
      { type: "league", contents: [{ uid: "s:2000~l:2030", displayName: "Formula 1", sport: "racing", defaultLeagueSlug: "f1" }] },
      { type: "article", contents: [{ displayName: "How Tampa Bay Rays, Milwaukee Brewers can win World Series" }] },
    ],
  });
  assert.deepEqual(found, [
    { kind: "team", id: "30", name: "Tampa Bay Rays", league: "baseball/mlb" },
    { kind: "league", id: "racing/f1", name: "Formula 1", league: "racing/f1" },
  ]);
  assert.deepEqual(readSearch(null), []);
});

test("a roster: grouped by position or one list, each player once, with headshot and jersey", () => {
  const p = (id, name, position, extra = {}) => ({ id, displayName: name, position: { displayName: position }, headshot: { href: `https://a.espncdn.com/${id}.png` }, jersey: "47", ...extra });
  const grouped = readRoster({ athletes: [{ position: "Pitchers", items: [p("40884", "Bryan Baker", "Relief Pitcher")] }, { position: "Designated Hitter", items: [p("33481", "Yandy Diaz", "Designated Hitter"), p("40884", "Bryan Baker", "Relief Pitcher")] }] });
  assert.deepEqual(grouped, [
    { id: "40884", name: "Bryan Baker", position: "Relief Pitcher", headshot: "https://a.espncdn.com/40884.png", group: "Pitchers", jersey: "47" },
    { id: "33481", name: "Yandy Diaz", position: "Designated Hitter", headshot: "https://a.espncdn.com/33481.png", group: "Designated Hitter", jersey: "47" },
  ]);
  const flat = readRoster({ athletes: [p("1", "Jayson Tatum", "Forward", { headshot: undefined, jersey: undefined })] });
  assert.deepEqual(flat, [{ id: "1", name: "Jayson Tatum", position: "Forward", headshot: null, group: null, jersey: null }]);
  assert.deepEqual(readRoster({ athletes: [] }), []);
});

test("a headshot at a face's size, through ESPN's own resizer (its full ones are ~210 KB); any other address as it is", () => {
  assert.equal(sizedHeadshot("https://a.espncdn.com/i/headshots/mlb/players/full/33481.png"), "https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/33481.png&w=160&h=160&scale=crop");
  const [p] = readRoster({ athletes: [{ id: "33481", displayName: "Yandy Diaz", headshot: { href: "https://a.espncdn.com/i/headshots/mlb/players/full/33481.png" } }] });
  assert.match(p.headshot, /^https:\/\/a\.espncdn\.com\/combiner\/i\?img=\/i\/headshots\/mlb\/players\/full\/33481\.png&w=160/);
  assert.equal(sizedHeadshot("https://upload.wikimedia.org/x.jpg"), "https://upload.wikimedia.org/x.jpg");
  assert.equal(sizedHeadshot(null), null);
});

test("a box score in ESPN's own tables: both teams, their columns, each line with who and whether they started", () => {
  const row = (id, name, stats, starter = true) => ({ starter, position: { displayName: "Designated Hitter" }, athlete: { id, displayName: name, headshot: { href: `https://a.espncdn.com/${id}.png` } }, stats });
  const box = readBoxScore({
    header: { id: "401908042", competitions: [{ status: FINAL, competitors: [{ homeAway: "home", team: BREWERS, score: "3", winner: true }, { homeAway: "away", team: RAYS, score: "2", winner: false }] }] },
    boxscore: {
      players: [
        {
          team: RAYS,
          statistics: [
            { type: "batting", labels: ["H-AB", "AB", "R", "H", "RBI", "AVG"], totals: ["7-31", "31", "2", "7", "2", ""], athletes: [row("33481", "Yandy Diaz", ["0-4", "4", "0", "0", "0", ".279"])] },
            { type: "pitching", labels: ["IP", "ERA"], athletes: [] },
          ],
        },
        { team: BREWERS, statistics: [{ type: "pitching", labels: ["IP", "H", "ERA"], athletes: [row("5080761", "Jacob Misiorowski", ["8.0", "7", ""], false)] }] },
      ],
    },
  });
  assert.deepEqual([box.event, box.state, box.final], ["401908042", "post", true]);
  assert.deepEqual(box.teams.map((t) => [t.team.name, t.score, t.winner, t.tables.map((x) => x.name)]), [["Tampa Bay Rays", "2", false, ["batting"]], ["Milwaukee Brewers", "3", true, ["pitching"]]]);
  const bat = box.teams[0].tables[0];
  assert.deepEqual(bat.labels, ["H-AB", "AB", "R", "H", "RBI", "AVG"]);
  assert.deepEqual(bat.totals, ["7-31", "31", "2", "7", "2", ""]);
  assert.deepEqual(bat.rows[0], { person: { id: "33481", name: "Yandy Diaz", position: "Designated Hitter", headshot: "https://a.espncdn.com/33481.png" }, values: ["0-4", "4", "0", "0", "0", ".279"], starter: true });
  assert.equal(box.teams[1].tables[0].rows[0].starter, false);
});

test("a soccer match sheet: each team's players' stats read as one table, in the order the columns first appear", () => {
  const stat = (abbreviation, displayValue) => ({ abbreviation, displayValue });
  const box = readBoxScore({
    header: { id: "401879254", competitions: [{ status: { type: { state: "post", completed: true } }, competitors: [{ homeAway: "home", team: { id: "384", displayName: "Crystal Palace" }, score: "1" }] }] },
    boxscore: { teams: [] },
    rosters: [
      {
        team: { id: "384", displayName: "Crystal Palace" },
        roster: [
          { starter: true, position: { displayName: "Goalkeeper" }, athlete: { id: "195738", displayName: "Walter Benítez" }, stats: [stat("APP", "1"), stat("SV", "4")] },
          { starter: false, athlete: { id: "2", displayName: "Unused Sub" }, stats: [] },
          { starter: true, athlete: { id: "3", displayName: "Eberechi Eze" }, stats: [stat("APP", "1"), stat("G", "1")] },
        ],
      },
    ],
  });
  const t = box.teams[0].tables[0];
  assert.equal(box.teams[0].score, "1");
  assert.deepEqual(t.labels, ["APP", "SV", "G"]);
  assert.deepEqual(t.rows.map((r) => [r.person.name, r.person.position, r.values]), [["Walter Benítez", "Goalkeeper", ["1", "4", ""]], ["Eberechi Eze", null, ["1", "", "1"]]]);
  assert.equal(readBoxScore({ header: { id: "1" }, boxscore: { teams: [] } }), null);
  assert.equal(readBoxScore(null), null);
});

test("season lines: every category's row for that year, the regular season only (its postseason holds the playoff games)", () => {
  const raw = {
    categories: [
      { name: "career-batting", displayName: "Career Batting", labels: ["GP", "HR"], statistics: [{ season: { year: 2025, displayName: "2025" }, teamSlug: "tampa-bay-rays", stats: [150, 25] }, { season: { year: 2026, displayName: "2026" }, teamSlug: "tampa-bay-rays", stats: [154, 22] }] },
      { name: "postseason-batting", displayName: "Postseason Batting", labels: ["GP", "HR"], statistics: [{ season: { year: 2026 }, teamSlug: "tampa-bay-rays", stats: ["12", "2"] }] },
      { name: "averages", displayName: "Averages", labels: ["GP", "PTS"], statistics: [{ season: { year: 2026, displayName: "2025-26" }, teamSlug: "boston-celtics", stats: ["16", "21.8"] }] },
    ],
  };
  assert.deepEqual(readSeasonStats(raw, 2026), [
    { category: "career-batting", name: "Career Batting", season: "2026", labels: ["GP", "HR"], values: ["154", "22"], team: "tampa-bay-rays" },
    { category: "averages", name: "Averages", season: "2025-26", labels: ["GP", "PTS"], values: ["16", "21.8"], team: "boston-celtics" },
  ]);
  assert.equal(readSeasonStats(raw, 2019), null);
  assert.equal(readSeasonStats(null, 2026), null);
});

test("the cache keeps a day's games 3 minutes while one's on, a month once the day's two days gone and all over, else an hour", () => {
  const now = Date.parse("2026-10-27T15:00:00Z");
  const e = (state, parts = []) => ({ state, parts });
  assert.equal(keepDay([e("post"), e("in")], "2026-10-27", now), 3 * 60_000);
  assert.equal(keepDay([e("pre", [{ state: "in" }])], "2026-10-27", now), 3 * 60_000);
  assert.equal(keepDay([e("post")], "2026-10-23", now), 30 * 86_400_000);
  assert.equal(keepDay([], "2026-10-23", now), 30 * 86_400_000);
  assert.equal(keepDay([e("post")], "2026-10-26", now), 3_600_000);
  assert.equal(keepDay([e("pre")], "2026-10-23", now), 3_600_000);
  assert.equal(keepDay([], "2026-10-30", now), 3_600_000);
});
