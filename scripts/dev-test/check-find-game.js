// Dev-only check of L7, finding a game (docs/PLAN-start-a-game-gpt.md track L): the server side of /api/sports/search, /schedule
// and /add (src/lib/server/sports/find.ts), on this lane's database and the stand-in ESPN (fake-espn.js), never the real one. No
// app server: it calls the app's own code through jiti.
//
// The stand-in has a ZT soccer league (soccer/zt-find: soccer reads every league, so its games have the sport's runtime) where ZT
// United (9101) has a season of 35 games: 20 played, then 15 to come, the first two a series against ZT City (9102) on consecutive
// days; and a cup (soccer/zt-find-cup) the search doesn't read lists of, where ZT Wanderers (9201) play. It checks:
//   a search: ZT United by its name (its logo and colour from its league's list, its next game), two teams as one matchup with
//   their next meeting, ZT Wanderers through ESPN's own search when no list has them, the cup searched by its list once a matchup's
//   made there; a league's list kept a week in the cache;
//   a team's schedule: its 36 games (one called off, in no add), the series still to come, its season as one to add (more than
//   30 games), their meetings;
//   adding: one game made as a season of the league's show and followed (one episode, the sport's runtime, its episode count);
//   the same again found, not made; the schedule then showing the season made for it; the whole season (35 episodes, keyed by
//   the team and its season, no summary asked for a game already played); their meetings; a series; the asks refused (no such
//   team, a game not theirs, more than 30, meetings with no one, a league that isn't one, no ask, a game called off); a league
//   spelled in capitals the same league; and the day's cap (ten made, the eleventh refused, one already made still added).
// Every row it makes is keyed "zt-find-" (the shows' slugs and sports_league, the matchups' keys; seasons, episodes, links and
// follows go with the shows), its events' leagues are "soccer/zt-find" and "soccer/zt-find-cup", its cache rows
// "zt-find-standin:", its user "zt-find-user"; it removes them at the end (--keep leaves them; the next run removes them first).
// Refuses a non-local database. Prints PASS/FAIL. Don't run it beside check-matchup.js (that one clears every "zt-" league show).
//
//   node scripts/dev-test/check-find-game.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const fakeEspn = require("./fake-espn");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-find-game runs against a local database only");
const keep = process.argv.includes("--keep");
const DAY = 24 * 3600_000;
const LEAGUE = "soccer/zt-find";
const CUP = "soccer/zt-find-cup";
const PREFIX = "zt-find-";
const USER = "zt-find-user";

const { pool } = jiti("../../src/lib/server/db.ts");
const { searchTeams, teamSchedule, addGames, MATCHUPS_A_DAY } = jiti("../../src/lib/server/sports/find.ts");
const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
/** The HTTP status an ask is refused with, or "ok". */
const refused = (p) => p.then(() => "ok", (e) => e.status ?? e.message);

async function down() {
  const shows = await pool.query("DELETE FROM shows WHERE sports_league LIKE $1 OR slug LIKE $1", [`${PREFIX}%`]);
  const events = await pool.query("DELETE FROM sports_events WHERE league = ANY($1)", [[LEAGUE, CUP]]);
  const cache = await pool.query("DELETE FROM sports_cache WHERE key LIKE $1", [`${PREFIX}standin:%`]);
  const user = await pool.query(`DELETE FROM "user" WHERE id = $1`, [USER]);
  return shows.rowCount + events.rowCount + cache.rowCount + user.rowCount;
}

(async () => {
  const gone = await down();
  if (gone) console.log(`(removed ${gone} rows a run before left)`);
  await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $1, $2, true, $1, $1, 'user', now(), now())`, [USER, `${USER}@example.invalid`]);
  const now = Date.now();
  const year = new Date(now).getUTCFullYear();
  const at = (ms) => new Date(now + ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const team = (id, name, short, abbreviation, league, extra = {}) => ({ id, name, short, location: name.replace(/ \w+$/, ""), abbreviation, league, ...extra });
  const united = team("9101", "ZT United", "United", "ZTU", LEAGUE, { color: "c8102e", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/zt-9101.png" });
  const city = team("9102", "ZT City", "City", "ZTC", LEAGUE);
  const rovers = team("9103", "ZT Rovers", "Rovers", "ZTR", LEAGUE);
  const wanderers = team("9201", "ZT Wanderers", "Wanderers", "ZTW", CUP, { color: "222222" });
  // ZT United's season: 20 played (every other day, back from yesterday), then 15 to come (every other day from tomorrow), the
  // first two against ZT City on consecutive days (a series), then ZT City and ZT Rovers (9103) in turn; every game this year's season, whatever its date.
  const events = [];
  for (let i = 0; i < 20; i++) {
    const other = i % 2 ? rovers : city;
    const home = i % 3 === 0;
    events.push({ league: LEAGUE, id: `zt-f${i + 1}`, at: at(-(40 - 2 * i) * DAY + DAY), home: home ? united.id : other.id, away: home ? other.id : united.id, state: "post", score: [2, 1], season: year, box: { [united.id]: { labels: ["G"], rows: [] }, [other.id]: { labels: ["G"], rows: [] } } });
  }
  for (let i = 0; i < 15; i++) {
    const other = i < 2 || i % 2 ? city : rovers;
    const home = i < 2 || i % 2 === 1;
    events.push({ league: LEAGUE, id: `zt-f${21 + i}`, at: at((i < 2 ? 1 + i : 2 * i) * DAY), home: home ? united.id : other.id, away: home ? other.id : united.id, state: "pre", season: year });
  }
  // A game called off (postponed: over, not completed), its makeup a game of its own.
  events.push({ league: LEAGUE, id: "zt-off", at: at(-41 * DAY), home: united.id, away: rovers.id, state: "post", off: true, season: year });
  events.push({ league: CUP, id: "zt-cup1", at: at(5 * DAY), home: wanderers.id, away: city.id, state: "pre", season: year });
  const espn = await fakeEspn.start({ teams: [united, city, rovers, wanderers], leagues: [{ league: LEAGUE, name: "ZT Find League", short: "ZT League" }, { league: CUP, name: "ZT Find Cup" }], events });
  const providers = sportsProviders({ base: espn.url, prefix: `${PREFIX}standin:` });
  const opts = { providers, prefix: PREFIX };
  const add = (ask) => addGames(USER, { league: LEAGUE, team: united.id, ...ask }, { ...opts, cast: false });
  const season = async (id) =>
    (await pool.query("SELECT ss.name, ss.episode_count, s.sports_league, (SELECT array_agg(runtime_min ORDER BY number) FROM season_episodes e WHERE e.season_id = ss.id) AS runtimes, (SELECT count(*)::int FROM season_events e WHERE e.season_id = ss.id) AS links, (SELECT key FROM sports_matchups m WHERE m.season_id = ss.id) AS key, (SELECT following FROM show_follows f WHERE f.season_id = ss.id AND f.user_id = $2) AS following FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [id, USER])).rows[0];
  try {
    // A search.
    const start = espn.asked.length;
    const found = await searchTeams("zt united", { ...opts, leagues: [LEAGUE] });
    const u = found.teams[0];
    check(u?.id === united.id && u.league === LEAGUE && u.leagueName === "ZT League" && u.logo === united.logo && u.color === "c8102e" && u.score === 100, "a team by its name, its logo and colour from its league's list", JSON.stringify(u));
    check(u?.next?.id === "zt-f21" && u.next.opponent?.id === city.id && u.next.home === true, "with its next game", JSON.stringify(u?.next));
    check(found.matchup === null, "one team's name is no matchup");
    const both = await searchTeams("zt city zt united", { ...opts, leagues: [LEAGUE] });
    check(both.matchup?.teams.map((t) => t.id).join() === "9102,9101" && both.matchup.next?.id === "zt-f21", "two teams as one matchup, with their next meeting", JSON.stringify(both.matchup));
    const asked = espn.asked.length;
    const searchedBefore = espn.asked.slice(start, asked).some((a) => a.startsWith("/apis/search/v2"));
    const cup = await searchTeams("zt wanderers", { ...opts, leagues: [LEAGUE] });
    check(cup.teams.length === 1 && cup.teams[0].id === wanderers.id && cup.teams[0].league === CUP && cup.teams[0].color === "222222", "a team no list has, through ESPN's own search, with its league's list's colour", JSON.stringify(cup.teams));
    check(!searchedBefore && espn.asked.slice(asked).some((a) => a.startsWith("/apis/search/v2")), "ESPN's search asked only when the lists find no one");
    const kept = (await pool.query("SELECT expires_at FROM sports_cache WHERE key = $1", [`${PREFIX}standin:espn:teams:${LEAGUE}`])).rows[0];
    const days = kept ? (kept.expires_at.getTime() - Date.now()) / DAY : 0;
    check(days > 6.9 && days <= 7, "a league's list kept a week in the cache", String(days));

    // A team's schedule.
    const s = await teamSchedule(LEAGUE, united.id, opts);
    check(s?.games.find((g) => g.id === "zt-off")?.calledOff === true && s.whole?.games.includes("zt-off") === false, "a game called off: listed as one, in no add", JSON.stringify(s?.games.find((g) => g.id === "zt-off")));
    check(s?.games.length === 36 && s.team.id === united.id && s.season === year && s.next === "zt-f21", "a team's schedule: its 36 games (35 played or to play), past and coming, and the next", JSON.stringify({ n: s?.games.length, season: s?.season, next: s?.next }));
    check(s?.series.length === 1 && s.series[0].games.join() === "zt-f21,zt-f22" && s.series[0].state === "coming" && s.series[0].home === true && /^City at United, /.test(s.series[0].name) && s.series[0].seasonId === null, "the series still to come, named", JSON.stringify(s?.series));
    check(s?.whole?.kind === "season" && s.whole.games.length === 35 && s.whole.name === `United, ${year} season` && s.whole.seasonId === null, "its season as one to add, more than 30 games", JSON.stringify(s?.whole && { ...s.whole, games: s.whole.games.length }));
    check(s?.games.every((g) => g.seasonId === null), "nothing made yet");
    const vs = await teamSchedule(LEAGUE, united.id, { ...opts, against: rovers.id });
    check(vs?.against?.id === rovers.id && vs.games.length === 18 && vs.whole?.kind === "meetings" && vs.whole.games.length === 17, "their meetings with one team", JSON.stringify({ n: vs?.games.length, whole: vs?.whole?.games.length }));
    check((await teamSchedule(LEAGUE, "zt-nobody", opts)) === null, "no such team: none");

    // Adding one game.
    const one = await add({ games: ["zt-f23"] });
    const s1 = await season(one.seasonId);
    check(one.made && s1?.episode_count === 1 && s1.runtimes.join() === "120" && s1.links === 1 && s1.sports_league === `${PREFIX}espn:${LEAGUE}`, "one game made as a season of the league's show: one episode, the sport's runtime", JSON.stringify({ one, s1 }));
    check(s1?.following === true, "and followed");
    const again = await add({ games: ["zt-f23"] });
    check(!again.made && again.seasonId === one.seasonId, "the same again: found, not made");
    const s2 = await teamSchedule(LEAGUE, united.id, opts);
    check(s2?.games.find((g) => g.id === "zt-f23")?.seasonId === one.seasonId, "the schedule shows the season made for it");

    // The whole season.
    const before = espn.asked.length;
    const whole = await add({ whole: "season" });
    const sw = await season(whole.seasonId);
    check(whole.made && whole.games.length === 35 && sw?.episode_count === 35 && sw.links === 35 && sw.runtimes.length === 35 && sw.key === `${PREFIX}espn:${LEAGUE}:season:${united.id}:${year}` && sw.name === `United, ${year} season`, "the whole season: 35 episodes, keyed by the team and its season", JSON.stringify({ ...whole, games: whole.games.length, sw: { ...sw, runtimes: sw?.runtimes?.length } }));
    check(!espn.asked.slice(before).some((a) => a.includes("/summary")), "no summary asked for a game already played", JSON.stringify(espn.asked.slice(before)));
    check((await teamSchedule(LEAGUE, united.id, opts))?.whole?.seasonId === whole.seasonId, "the schedule shows the season made for the whole");
    check(!(await add({ whole: "season" })).made, "the season again: found");

    // Their meetings, and a series.
    const meet = await add({ whole: "meetings", against: city.id });
    check(meet.made && meet.games.length === 18, "their meetings with one team", JSON.stringify({ ...meet, games: meet.games.length }));
    const series = await add({ games: ["zt-f21", "zt-f22"] });
    check(series.made && /^City at United, /.test(series.name) && (await teamSchedule(LEAGUE, united.id, opts))?.series[0].seasonId === series.seasonId, "a series, shown as made", series.name);

    // A matchup made in the cup: its list searched by name from then on.
    await addGames(USER, { league: CUP, team: wanderers.id, games: ["zt-cup1"] }, { ...opts, cast: false });
    const listed = await searchTeams("wanderers", opts);
    check(listed.teams[0]?.id === wanderers.id && listed.teams[0].score === 96, "a league a matchup's been made in is searched by its list", JSON.stringify(listed.teams.map((t) => [t.id, t.score])));

    // Asks refused.
    check((await refused(addGames(USER, { league: LEAGUE, team: "zt-nobody", games: ["zt-f1"] }, opts))) === 404, "no such team: 404");
    check((await refused(add({ games: ["zt-cup1"] }))) === 404, "a game not theirs: 404");
    check((await refused(add({ games: Array.from({ length: 31 }, (_, i) => `zt-f${i + 1}`) }))) === 400, "more than 30 games: 400");
    check((await refused(add({ whole: "meetings" }))) === 400, "meetings with no one: 400");
    check((await refused(addGames(USER, { league: "not a league", team: "1", games: ["1"] }, opts))) === 400, "a league that isn't one: 400");
    check((await refused(addGames(USER, null, opts))) === 400, "no ask at all: 400");
    check((await refused(add({ games: ["zt-off"] }))) === 400, "a game called off: 400");
    const upper = await addGames(USER, { league: LEAGUE.toUpperCase(), team: united.id, games: ["zt-f23"] }, { ...opts, cast: false });
    check(upper.seasonId === one.seasonId && !upper.made, "a league spelled in capitals is the same league", JSON.stringify(upper));

    // The day's cap: five made so far (a game, the season, the meetings, the series, the cup's game).
    const made = (await pool.query("SELECT count(*)::int AS n FROM sports_matchups WHERE made_by = $1", [USER])).rows[0].n;
    for (let i = made; i < MATCHUPS_A_DAY; i++) await add({ games: [`zt-f${24 + i}`] });
    check((await refused(add({ games: ["zt-f1"] }))) === 429, `the day's cap: ${MATCHUPS_A_DAY} made, the next refused`);
    check((await refused(add({ games: ["zt-f23"] }))) === "ok", "one already made is still added past the cap");
  } finally {
    await espn.close();
    if (!keep) await down();
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
