// A league's slate (docs/PLAN-start-a-game-gpt.md track L, L8): ESPN's calendar read (src/lib/server/sports/espn.ts readCalendar:
// its season, stages and days or weeks), and a season of a whole league's games cut into episodes (src/lib/sports/slate.ts): the
// NFL's weeks as ESPN numbers them, the NBA's and MLB's days and Monday-to-Sunday weeks, the Premier League's rounds (ESPN numbers
// none), windows that tile so a game listed later finds its episode, names and keys; a slate's episode locking at its own first game (its week). On
// ESPN's real answers (tests/fixtures/espn/*-schedule-league-*.json, recorded 2026-11-06 by scripts/dev-test/record-espn-slate.js).
// Making one in the database and keeping its games linked is scripts/dev-test/check-slate.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readCalendar, readScoreboard } = jiti("../src/lib/server/sports/espn.ts");
const S = jiti("../src/lib/sports/slate.ts");
const { locksOf } = jiti("../src/lib/sports/locks.ts");

const load = (file, league) => {
  const j = require(`./fixtures/espn/${file}.json`);
  const calendar = readCalendar(j.scoreboard, j.types);
  const events = Object.values(j.months).flatMap((m) => readScoreboard(league, m));
  return { calendar, events, games: events.filter((e) => e.competitors.length === 2).map((e) => ({ id: e.id, at: e.at, teams: e.competitors.map((c) => c.team.id), stage: e.stage, state: e.state, final: e.final })) };
};
const nfl = load("nfl-schedule-league-2026", "football/nfl");
const nba = load("nba-schedule-league-2027", "basketball/nba");
const mlb = load("mlb-schedule-league-2026", "baseball/mlb");
const epl = load("eng.1-schedule-league-2026", "soccer/eng.1");
const regular = (x) => x.games.filter((g) => (g.stage ?? "regular") === "regular");

test("ESPN's calendar: a season's stages with their bounds, and its days or its weeks", () => {
  assert.equal(nfl.calendar.season, 2026);
  assert.equal(nfl.calendar.label, "2026");
  assert.deepEqual(nfl.calendar.stages.map((s) => [s.type, s.stage]), [[1, "pre"], [2, "regular"], [3, "post"], [4, "other"]]);
  assert.deepEqual(nfl.calendar.days, []);
  const reg = nfl.calendar.weeks.filter((w) => w.type === 2);
  assert.equal(reg.length, 18);
  assert.equal(reg[0].label, "Week 1");
  assert.equal(nfl.calendar.weeks.filter((w) => w.type === 1).length, 4);
  // The NBA's: days (Pacific midnights, read as their own dates), a play-in that is neither stage.
  assert.equal(nba.calendar.season, 2027);
  assert.equal(nba.calendar.label, "2026-27");
  assert.deepEqual(nba.calendar.stages.map((s) => s.stage), ["pre", "regular", "post", "other", "other"]);
  assert.ok(nba.calendar.days.includes("2026-11-02") && nba.calendar.days.includes("2026-11-01"));
  assert.ok(!nba.calendar.days.includes("2026-11-03"), "election day: no games");
  assert.deepEqual(nba.calendar.weeks, []);
  // A soccer league's season is one stage of its own: its whole season.
  assert.deepEqual(epl.calendar.stages.map((s) => [s.type, s.stage]), [[14308, null]]);
  assert.equal(S.seasonWords(epl.calendar), "2026-27");
  assert.deepEqual(S.stageDays(epl.calendar, "regular"), { from: "2026-05-31", to: "2027-05-31", type: 14308 });
  assert.deepEqual(S.stageDays(nba.calendar, "regular"), { from: "2026-10-20", to: "2027-04-11", type: 2 });
  assert.equal(S.stageDays(epl.calendar, "post"), null);
  assert.equal(readCalendar({ leagues: [{}] }, []), null);
});

test("the ways a league's slate is cut: football by ESPN's weeks; a daily sport by week or day; soccer by round or day", () => {
  assert.deepEqual(S.cadencesOf(nfl.calendar, "weekly"), ["week"]);
  assert.deepEqual(S.cadencesOf(nba.calendar, "daily"), ["week", "day"]);
  assert.deepEqual(S.cadencesOf(epl.calendar, "weekly"), ["round", "day"]);
  assert.deepEqual(S.cadencesOf(nba.calendar, "event"), []);
});

test("the NFL by its weeks: ESPN's 18, each week's games in it (Thursday to Monday night), the windows tiling", () => {
  const eps = S.slateEpisodes(nfl.calendar, "regular", "week", regular(nfl));
  assert.equal(eps.length, 18);
  assert.deepEqual(eps.map((e) => e.label).slice(0, 3), ["Week 1", "Week 2", "Week 3"]);
  assert.equal(eps.reduce((n, e) => n + e.games.length, 0), 272, "every regular-season game in a week");
  for (const e of eps) assert.ok(e.games.length >= 13 && e.games.length <= 16, `${e.label}: ${e.games.length}`);
  assert.equal(eps[0].from, "2026-09-06");
  assert.equal(eps[0].to, "2026-09-15");
  for (let i = 1; i < eps.length; i++) assert.equal(eps[i].from, S.dayOf(new Date(Date.parse(`${eps[i - 1].to}T12:00:00Z`) + 86_400_000).toISOString()), "tiled");
  // Week 1's Monday night game is week 1's, its Thursday opener too.
  const wk1 = regular(nfl).filter((g) => eps[0].games.includes(g.id)).map((g) => S.dayOf(g.at)).sort();
  assert.equal(wk1[0], "2026-09-09", "the Wednesday opener");
  assert.equal(wk1.at(-1), "2026-09-14");
  assert.equal(eps[0].detail, "Sep 6-15");
  // The last week reaches the regular season's last day (a game moved after it is still its).
  assert.equal(eps[17].to, "2027-01-12");
  // The playoffs: ESPN's own weeks (Wild Card ...), games as they're listed.
  const post = S.slateEpisodes(nfl.calendar, "post", "week", nfl.games.filter((g) => g.stage === "post"));
  assert.ok(post.length >= 4 && post[0].label.length > 0);
  assert.equal(S.slateName("NFL", nfl.calendar, "regular", "week", "week"), "NFL 2026");
  assert.equal(S.slateName("NFL", nfl.calendar, "post", "week", "week"), "NFL 2026 playoffs");
  assert.equal(S.slateKey("espn", "football/nfl", 2026, "regular", "week"), "espn:football/nfl:slate:2026:regular:week");
});

test("the NBA by day and by week: ESPN's days of the stage, Monday to Sunday weeks, a day off in the next one's window", () => {
  const days = S.slateEpisodes(nba.calendar, "regular", "day", regular(nba));
  // The regular season's days from ESPN's calendar (its whole season's, November's games placed).
  assert.equal(days[0].from, "2026-10-20");
  const nov1 = days.find((e) => e.to === "2026-11-01");
  assert.equal(nov1.label, "Sun, Nov 1");
  assert.equal(nov1.games.length, 4);
  // Election day has no games: it's Wednesday's window.
  const nov4 = days.find((e) => e.to === "2026-11-04");
  assert.equal(nov4.from, "2026-11-03");
  assert.equal(S.episodeFor(days, "2026-11-03"), nov4.n);
  assert.equal(S.episodeFor(days, "2026-10-01"), null);
  const novGames = regular(nba).length;
  assert.equal(days.reduce((n, e) => n + e.games.length, 0), novGames);
  const weeks = S.slateEpisodes(nba.calendar, "regular", "week", regular(nba));
  assert.equal(weeks[0].from, "2026-10-19", "the season's first week from its Monday");
  for (const w of weeks) assert.equal(new Date(`${w.from}T12:00:00Z`).getUTCDay(), w.n === 1 ? 1 : 1);
  const wk = weeks.find((w) => w.from === "2026-11-02");
  assert.equal(wk.to, "2026-11-08");
  assert.equal(wk.label, `Week ${wk.n}`);
  assert.ok(wk.games.length > 40, `${wk.games.length} games`);
  assert.equal(weeks.reduce((n, e) => n + e.games.length, 0), novGames);
  assert.ok(weeks.length >= 25 && weeks.length <= 26, `${weeks.length} weeks`);
  assert.equal(S.slateName("NBA", nba.calendar, "regular", "day", "week"), "NBA 2026-27, day by day");
});

test("MLB's June: a postponed game stays on its day, its makeup on another (a doubleheader's two in one day's episode)", () => {
  const games = regular(mlb);
  const days = S.slateEpisodes(mlb.calendar, "regular", "day", games);
  // The calendar now is the postseason's (its days from late September): June's days come from its games.
  assert.equal(days.filter((e) => e.to.startsWith("2026-06")).length, 30);
  // Cubs at Mets, June 22: postponed (over, not completed), kept on its day; its makeup a new event (401879401), the first of a
  // doubleheader on June 24, both in that day's episode.
  const off = mlb.events.find((e) => e.id === "401815854");
  assert.equal(off.state, "post");
  assert.equal(off.final, false);
  assert.ok(days.find((e) => e.to === "2026-06-22").games.includes("401815854"));
  const jun24 = days.find((e) => e.to === "2026-06-24");
  const twice = games.filter((g) => jun24.games.includes(g.id) && g.teams.includes("16") && g.teams.includes("21")).map((g) => g.id);
  assert.deepEqual(twice.sort(), ["401815882", "401879401"]);
  const weeks = S.slateEpisodes(mlb.calendar, "regular", "week", games);
  // (ESPN's calendar now holds a few later regular-season days too: their weeks after.)
  assert.deepEqual(weeks.map((w) => w.from).slice(0, 5), ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29"]);
  assert.equal(weeks.reduce((n, e) => n + e.games.length, 0), games.length);
});

test("the Premier League by round: each team once a round, its 38 of 10", () => {
  const rounds = S.slateEpisodes(epl.calendar, "regular", "round", epl.games);
  assert.equal(epl.games.length, 380);
  assert.equal(rounds.reduce((n, e) => n + e.games.length, 0), 380);
  for (const r of rounds) {
    const teams = epl.games.filter((g) => r.games.includes(g.id)).flatMap((g) => g.teams);
    assert.equal(new Set(teams).size, teams.length, `${r.label}: a team twice`);
  }
  // Exactly the league's 38 of 10 (the later ones listed on one placeholder day each until their kickoffs are set).
  assert.equal(rounds.length, 38);
  assert.ok(rounds.every((r) => r.games.length === 10));
  assert.equal(rounds[37].detail, "May 30");
  assert.equal(rounds[37].to, "2027-05-31", "the last round to the season's last day");
  assert.equal(rounds[0].label, "Round 1");
  assert.equal(rounds[0].detail, "Aug 21 – 24");
  assert.equal(S.slateName("Premier League", epl.calendar, "regular", "round", "round"), "Premier League 2026-27");
});

test("words and months", () => {
  assert.equal(S.spanWords("2026-11-02", "2026-11-08"), "Nov 2 – 8");
  assert.equal(S.spanWords("2026-10-27", "2026-11-02"), "Oct 27 – Nov 2");
  assert.equal(S.spanWords("2026-11-08", "2026-11-08"), "Nov 8");
  assert.equal(S.mondayOf("2026-11-08"), "2026-11-02");
  assert.equal(S.mondayOf("2026-11-02"), "2026-11-02");
  assert.deepEqual(S.monthsOf("2026-11-20", "2027-02-03"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(S.episodeLabel("day", 3, "2026-11-08"), "Sun, Nov 8");
  assert.equal(S.episodeLabel("round", 3, "2026-11-08"), "Round 3");
});

test("a slate's episode is its week: it locks at its own first game, by start, day or week (L8 part 3)", () => {
  const starts = [
    { episode: 1, at: "2026-11-02T23:00:00Z" },
    { episode: 1, at: "2026-11-02T19:00:00Z" },
    { episode: 1, at: "2026-11-05T00:00:00Z" },
    { episode: 2, at: "2026-11-09T23:00:00Z" },
  ];
  for (const closes of ["start", "daily", "weekly"]) assert.equal(locksOf(starts, closes, { slate: true }).get(1), "2026-11-02T19:00:00.000Z", closes);
  assert.equal(locksOf(starts, "weekly", { slate: true }).get(2), "2026-11-09T23:00:00.000Z");
  // A Monday-to-Sunday week whose Monday is in the Tuesday-to-Monday week before: its own first game, not last week's.
  const weeks = [
    { episode: 1, at: "2026-10-27T23:00:00Z" },
    { episode: 1, at: "2026-10-30T23:00:00Z" },
    { episode: 2, at: "2026-11-03T00:00:00Z" },
    { episode: 2, at: "2026-11-05T00:00:00Z" },
  ];
  assert.equal(locksOf(weeks, "weekly", { slate: true }).get(2), "2026-11-03T00:00:00.000Z");
  // A slate's episode of one game (a soccer day's one match, a week with one game listed so far) is still its own week, where
  // the calendar would lock Saturday's with Tuesday's.
  const days = [{ episode: 1, at: "2026-11-03T20:00:00Z" }, { episode: 2, at: "2026-11-07T15:00:00Z" }];
  assert.equal(locksOf(days, "weekly", { slate: true }).get(2), "2026-11-07T15:00:00.000Z");
  // Anything else (a team's season, a matchup's series: nothing defines a week of its own) keeps the Tuesday-to-Monday week.
  assert.equal(locksOf(days, "weekly").get(2), "2026-11-03T20:00:00.000Z");
});

test("the Premier League by round locks each round at its own first match, not the calendar's week (L8 part 3)", () => {
  const rounds = S.slateEpisodes(epl.calendar, "regular", "round", epl.games);
  const at = new Map(epl.games.map((g) => [g.id, g.at]));
  const starts = rounds.flatMap((r) => r.games.map((id) => ({ episode: r.n, at: at.get(id) })));
  const locks = locksOf(starts, "weekly", { slate: true });
  const first = (r) => new Date(Math.min(...r.games.map((id) => Date.parse(at.get(id))))).toISOString();
  for (const r of rounds) assert.equal(locks.get(r.n), first(r), `round ${r.n}`);
  // A midweek round and the weekend's after it share a Tuesday-to-Monday week: the calendar would lock the weekend's round at
  // the midweek one's first match, before any of its own.
  const calendar = locksOf(starts, "weekly");
  const differ = rounds.filter((r) => calendar.get(r.n) !== locks.get(r.n));
  assert.ok(differ.length > 0, "some round shares a calendar week with another");
  for (const r of differ) assert.ok(Date.parse(calendar.get(r.n)) < Date.parse(first(r)));
});
