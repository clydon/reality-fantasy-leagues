// A game through the playoffs (docs/PLAN-sports-ready.md step 2.7; the user, 2026-11-20: a game's timing is the maker's, the regular
// season by default or on through the playoffs to the final). A league's full slate, its regular season's episodes then its
// playoffs' (src/lib/sports/slate.ts: the NFL's Wild Card to Super Bowl after Week 18, an exhibition's week or game never one), where
// a team stands in its league's playoffs (src/lib/sports/playoffs.ts teamInPlayoffs, playoffsOver: on ESPN's own 2026 playoffs as
// recorded), and the engine's end for a game with no end of its own once its season's over (state.seasonLast: StateLogic.lastEpisode,
// gameOver; head to head's playoffs at the game's own end). On ESPN's recorded answers (tests/fixtures/espn). Making one in the
// database and playing a season through it is scripts/dev-test/check-sports-through-playoffs.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readCalendar, readScoreboard } = jiti("../src/lib/server/sports/espn.ts");
const S = jiti("../src/lib/sports/slate.ts");
const P = jiti("../src/lib/sports/playoffs.ts");
const { teamOfKey } = jiti("../src/lib/server/sports/team-season.ts");
const SL = require("../src/lib/game/state-logic.js");

const load = (file, league) => {
  const j = require(`./fixtures/espn/${file}.json`);
  const calendar = j.scoreboard ? readCalendar(j.scoreboard, j.types) : null;
  const events = Object.values(j.months).flatMap((m) => readScoreboard(league, m));
  return { calendar, events };
};
const nfl = load("nfl-schedule-league-2026", "football/nfl");
const nba = load("nba-schedule-league-2027", "basketball/nba");
const epl = load("eng.1-schedule-league-2026", "soccer/eng.1");
/** ESPN's 2026 playoffs (the 2025 season's NFL postseason: January and February 2026) as the series read them. */
const playoffsOf = (k, league) =>
  load(`${k}-schedule-playoffs-2026`, league).events.map((e) => ({ id: e.id, note: e.note, bestOf: e.bestOf ?? null, at: e.at, status: e.final ? "final" : e.state, sides: e.competitors.map((c) => ({ id: c.team.id, score: Number(c.score) || 0 })) }));
const nflPost = playoffsOf("nfl", "football/nfl");
const nbaPost = playoffsOf("nba", "basketball/nba");
/** The games listed before `at` (an ISO day), the ones after it still to play. */
const asOf = (games, at) => games.filter((g) => g.at < at).map((g) => g).concat(games.filter((g) => g.at >= at).map((g) => ({ ...g, status: "pre", sides: g.sides.map((s) => ({ ...s, score: 0 })) })));
const listedBy = (games, at) => games.filter((g) => g.at < at);

test("a full slate: the NFL's 18 weeks, then its playoffs' four weeks as ESPN's calendar lists them, tiling across the line", () => {
  assert.ok(S.hasFull(nfl.calendar));
  const eps = S.slateEpisodes(nfl.calendar, "full", "week", []);
  assert.equal(eps.length, 22);
  assert.equal(S.regularThrough(nfl.calendar, "full", "week"), 18);
  assert.deepEqual(eps.slice(17).map((e) => [e.n, e.label]), [[18, "Week 18"], [19, "Wild Card"], [20, "Divisional Round"], [21, "Conference Championship"], [22, "Super Bowl"]]);
  assert.equal(eps[17].to, "2027-01-12");
  assert.equal(eps[18].from, "2027-01-13", "the playoffs start the day after the regular season's last");
  for (let i = 1; i < eps.length; i++) assert.equal(eps[i].from, S.dayOf(new Date(Date.parse(`${eps[i - 1].to}T12:00:00Z`) + 86_400_000).toISOString()), "tiled");
  assert.deepEqual(S.stageDays(nfl.calendar, "full"), { from: "2026-09-06", to: "2027-02-15", type: 2 });
  assert.equal(S.slateKey("espn", "football/nfl", 2026, "full", "week"), "espn:football/nfl:slate:2026:full:week");
  assert.equal(S.slateName("NFL", nfl.calendar, "full", "week", "week"), "NFL 2026");
  // A slate of one stage has no regular end of its own.
  assert.equal(S.regularThrough(nfl.calendar, "regular", "week"), null);
});

test("a full slate's playoffs grow as they're listed where the calendar can't say them: the NBA's days and weeks", () => {
  for (const cadence of ["week", "day"]) {
    const eps = S.slateEpisodes(nba.calendar, "full", cadence, []);
    const reg = S.slateEpisodes(nba.calendar, "regular", cadence, []);
    assert.equal(S.regularThrough(nba.calendar, "full", cadence), reg.length);
    assert.equal(eps.length, reg.length, `${cadence}: the playoffs' days aren't listed yet`);
    assert.equal(eps.at(-1).to, "2027-04-11", "the regular season's last day");
  }
  // With a playoff day's games listed: an episode after the regular season's last, numbered on, its label the slate's own.
  const day = "2027-04-18";
  const game = { id: "p1", at: `${day}T19:00:00Z`, teams: ["1", "2"] };
  const withPost = { ...nba.calendar, days: [...nba.calendar.days, day] };
  const eps = S.slateEpisodes(withPost, "full", "day", [game]);
  const reg = S.regularThrough(withPost, "full", "day");
  assert.equal(eps.length, reg + 1);
  assert.deepEqual([eps.at(-1).n, eps.at(-1).label, eps.at(-1).games], [reg + 1, "Sun, Apr 18", ["p1"]]);
  assert.equal(eps.at(-1).from, "2027-04-12", "tiled: the play-in's days fall to the playoffs' first window");
});

test("a league of one season (the Premier League) has no full slate; an exhibition is never a slate's game or week", () => {
  assert.equal(S.hasFull(epl.calendar), false);
  assert.equal(S.stageDays(epl.calendar, "full"), null);
  assert.deepEqual(S.slateEpisodes(epl.calendar, "full", "round", []), []);
  for (const words of ["Pro Bowl Games", "Pro Bowl", "NBA All-Star Game", "MLB All-Stars"]) assert.ok(S.isExhibition(words), words);
  for (const words of ["Super Bowl LX", "AFC Wild Card Playoffs", "Bowls", "East 1st Round - Game 3", null]) assert.ok(!S.isExhibition(words), String(words));
  // A calendar with a Pro Bowl week of its own (the 2025 season's): left out, the weeks still tiling.
  const weeks = [
    ...nfl.calendar.weeks.filter((w) => w.type !== 3),
    { type: 3, label: "Wild Card", detail: null, from: "2027-01-13T08:00Z", to: "2027-01-20T07:59Z" },
    { type: 3, label: "Divisional Round", detail: null, from: "2027-01-20T08:00Z", to: "2027-01-27T07:59Z" },
    { type: 3, label: "Conference Championship", detail: null, from: "2027-01-27T08:00Z", to: "2027-02-03T07:59Z" },
    { type: 3, label: "Pro Bowl", detail: null, from: "2027-02-03T08:00Z", to: "2027-02-10T07:59Z" },
    { type: 3, label: "Super Bowl", detail: null, from: "2027-02-10T08:00Z", to: "2027-02-16T07:59Z" },
  ];
  const eps = S.slateEpisodes({ ...nfl.calendar, weeks }, "full", "week", []);
  assert.deepEqual(eps.slice(18).map((e) => e.label), ["Wild Card", "Divisional Round", "Conference Championship", "Super Bowl"]);
  assert.equal(eps[21].from, "2027-02-03", "the Super Bowl's window takes the Pro Bowl's days");
});

test("where a team stands in the NFL's playoffs: a bye isn't out, a loss is, the champion; out with no game once a later round is listed in full", () => {
  const SEA = "26", BUF = "2", PIT = "23", DEN = "7", NE = "17", MIA = "15";
  const wcListed = "2026-01-14"; // after the Wild Card games, before the Divisional Round's are listed
  const wc = listedBy(nflPost, wcListed);
  assert.equal(P.teamInPlayoffs(PIT, wc), "out", "lost its Wild Card game");
  assert.equal(P.teamInPlayoffs(BUF, wc), "in", "won its Wild Card game");
  assert.equal(P.teamInPlayoffs(DEN, wc), "none", "a bye: not out");
  assert.equal(P.teamInPlayoffs(MIA, wc), "none", "nothing says it yet: the Wild Card round isn't full (six of eight)");
  const div = asOf(nflPost.filter((g) => g.at < "2026-01-19"), "2026-01-17");
  assert.equal(P.teamInPlayoffs(DEN, div), "in", "the bye's Divisional game listed");
  assert.equal(P.teamInPlayoffs(MIA, div), "out", "the Divisional Round listed in full without them");
  const all = nflPost;
  assert.equal(P.teamInPlayoffs(BUF, all), "out", "lost at Denver in the Divisional Round");
  assert.equal(P.teamInPlayoffs(SEA, all), "champion");
  assert.equal(P.teamInPlayoffs(NE, all), "out", "lost the Super Bowl");
  assert.equal(P.playoffsOver(all), true);
  assert.equal(P.playoffsOver(asOf(all, "2026-02-08")), false, "the Super Bowl still to play");
  assert.equal(P.teamInPlayoffs(SEA, asOf(all, "2026-02-08")), "in");
});

test("where a team stands in the NBA's playoffs: a series lost, the Finals won, a series in progress", () => {
  const series = P.seriesOf(nbaPost);
  const final = series.find((s) => s.fromFinal === 1);
  assert.ok(final?.winner);
  const loser = final.sides.find((id) => id !== final.winner);
  assert.equal(P.teamInPlayoffs(final.winner, nbaPost), "champion");
  assert.equal(P.teamInPlayoffs(loser, nbaPost), "out");
  // A first-round loser: out; mid-series, still in.
  const r1 = series.find((s) => s.fromFinal === 4 && s.winner);
  const beaten = r1.sides.find((id) => id !== r1.winner);
  assert.equal(P.teamInPlayoffs(beaten, nbaPost), "out");
  const g1 = nbaPost.filter((g) => r1.games.includes(g.id)).sort((a, b) => a.at.localeCompare(b.at))[0];
  assert.equal(P.teamInPlayoffs(beaten, asOf(nbaPost.filter((g) => g.at <= g1.at), g1.at)), "in", "its series about to start");
  assert.equal(P.playoffsOver(nbaPost), true);
});

test("a team's season's key names the team and its year", () => {
  assert.deepEqual(teamOfKey("espn:football/nfl:season:21:2026"), { team: "21", year: 2026 });
  assert.deepEqual(teamOfKey("zt-espn:basketball/zt-nba:season:13:2027"), { team: "13", year: 2027 });
  assert.equal(teamOfKey("espn:football/nfl:401872958"), null);
});

const CTX = { moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true, jury: true, phases: [] };
const lineup = (more = {}) => ({ preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null }, ...more });
/** A league of three seats over `n` episodes on `spec` (matchups.test.js's). */
function league(spec, n = 22) {
  const s = SL.defaultState();
  SL.updateSettings(s, "showId", "zt-sport");
  for (let i = 0; i < 9; i++) SL.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  SL.updateSettings(s, "setupComplete", true);
  assert.deepEqual(SL.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= n; k++) SL.ensureEpisodeNumber(s, k, false);
  return s;
}

test("a game with no end of its own ends with its season once that's over (state.seasonLast), never before", () => {
  const open = league(lineup({ span: { from: 1, to: null } }));
  assert.equal(SL.endEpisode(open), null);
  assert.equal(SL.lastEpisode(open), null, "runs on while the season may grow");
  open.seasonLast = 22;
  assert.equal(SL.lastEpisode(open), 22);
  assert.equal(SL.endEpisode(open), null, "the span's own end stays none, for what it says and for Game settings");
  // An end of its own wins (the regular season's: Week 18).
  const regular = league(lineup({ span: { from: 1, to: 18 } }));
  regular.seasonLast = 22;
  assert.equal(SL.lastEpisode(regular), 18);
  // Never saved.
  assert.ok(SL.StatsLogic.stampedKeys().includes("seasonLast"));
});

test("head to head's playoffs at the game's own end: a regular season's game by Week 17, one through the Super Bowl at its week", () => {
  const M = SL.MatchupLogic;
  const h2h = (to) => league(lineup({ rank: { by: "matchups", playoffs: { teams: 2 } }, span: { from: 1, to } }));
  // The server's stamps (air-times.ts stampSeasonLength): the season's length, and the regular season's cap only for a game ending in it.
  const reg = h2h(18);
  Object.assign(reg, { seasonEpisodes: 22, playoffsBy: 17 });
  assert.equal(M.endsAt(reg), 17, "Week 18 its end: the final still Week 17's");
  const final = h2h(null);
  final.seasonEpisodes = 22;
  assert.equal(M.endsAt(final), 22, "through the Super Bowl: the final in its week");
  assert.equal(SL.lastEpisode(final), 22);
});

test("Start a game's How long on a season that goes on into its playoffs: the regular season (the default), or through the final", () => {
  const M = jiti("../src/new/couch/gallery-bold/model.ts");
  const playoffs = { through: 18, fantasy: 17, final: "the Super Bowl" };
  const input = { from: 15, ep: "week", eps: "weeks", stages: [], ownPace: false, playoffs };
  const stats = { score: { by: "stats" } };
  const answers = { score: { by: "answers" } };
  // A stats game's regular season ends with the fantasy season's (Week 17); any other's with the regular season's.
  assert.equal(M.regularTo(input, stats), 17);
  assert.equal(M.regularTo(input, answers), 18);
  assert.equal(M.regularTo({ ...input, from: 18 }, stats), 18, "started in Week 18: the regular season's end");
  assert.equal(M.regularTo({ ...input, from: 19 }, stats), null, "started in the playoffs: no regular season left");
  assert.equal(M.regularTo({ ...input, playoffs: null }, stats), null);
  // With no spec (the engine's check left out), the regular season's end is the regular season's.
  const ids = (inp) => M.lengthsOf(null, inp, null).map((l) => [l.id, l.label, l.span.to]);
  assert.deepEqual(ids(input), [["next", "Just Week 15", 15], ["regular", "Regular season", 18], ["final", "Through the Super Bowl", null]]);
  assert.deepEqual(ids({ ...input, from: 19 }), [["next", "Just Week 19", 19], ["final", "Through the Super Bowl", null]]);
  assert.deepEqual(ids({ ...input, playoffs: null }), [["next", "Just Week 15", 15], ["rest", "The rest of the season", null]]);
  // Which chip a game's span is.
  assert.equal(M.lengthId({ from: 15, to: null }, input), "final");
  assert.equal(M.lengthId({ from: 15, to: 17 }, input), "regular");
  assert.equal(M.lengthId({ from: 15, to: 18 }, input), "regular");
  assert.equal(M.lengthId({ from: 15, to: 15 }, input), "next");
  assert.equal(M.lengthId({ from: 15, to: null }, { ...input, playoffs: null }), "rest");
});
