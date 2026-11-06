// Dev-only check of L8, a league's slate (docs/PLAN-start-a-game-gpt.md track L): a season of a whole league's games, several an
// episode (src/lib/server/sports/slate.ts), and every reader of a season's linked games taking several an episode, on this lane's
// database and the stand-in ESPN (fake-espn.js), never the real one. No app server: it calls the app's own code through jiti.
//
// The stand-in's NBA ("basketball/nba", its events "zt-sl-*") is in its regular season, ten days in, thirty to go, then five days
// of playoffs, with four teams (each a roster of two); a day off (no games: not one of ESPN's days) four days on. It checks:
//   made by day: an episode each of ESPN's days in the stage, the games from three days back to eight ahead linked (a day's two,
//   a doubleheader's two, a postponed game on its day, its makeup on the day off: the next day's episode), each one's air time its
//   first game's start, the league's show, its key, the listings' linking leaving it alone, its people from the linked teams'
//   rosters; asked again: found; by week (Monday to Sunday), its own; by round: refused; the playoffs before any are listed refused
//   ... then made from ESPN's days, and a game listed after its last day adding an episode;
//   kept current (syncSlate): a game moved to another day moved to its episode, a game listed later linked, a game three weeks on
//   linked once its day's read, the season's status; the daily job's part (refreshSportsEvents) running it first;
//   read: a day's locks at its first game; the Players tab's lines a game each (the doubleheader's two for one player);
//   leagueGames on an episode of two final games: each game's facts and lines apart, the episode's added up, every episode of a
//   slate in its shape (one of one game too);
//   a soccer league ("soccer/zt-slate") by round: its fixtures read month by month, each team once a round, all linked at once.
// And finding and adding one (L8 part 2: slate.ts leagueSlates, find.ts searchTeams' leagues and addSlate): what a league's slate
// can be (its season, its stages, each cut each way with its episodes; a soccer league's rounds from its fixtures; the seasons made
// for them once made, the playoffs' grown); a tour's league no slate; no such league none; a league found by its list's names
// ("nba"), and through ESPN's search ("zt slate league"), a promotion's with no slate; adding one through addSlate (one made found
// and followed, a new one made and followed, a league in capitals, the asks refused: a cadence it isn't cut by, a stage or cadence
// that isn't one, no slate, a tour's, no such league), the day's cap counted with matchups (the next refused, one made still free).
// Every row it makes is keyed "zt-slate-" (the shows' slugs and sports_league; seasons, episodes, links and slates go with the
// shows), its events "zt-sl-*", its cache rows "zt-slate-standin:", its user "zt-slate-user"; it removes them at the end (--keep leaves them; the next run
// removes them first). Refuses a non-local database. Prints PASS/FAIL. Don't run it beside check-matchup.js (that one clears
// every "zt-" league show).
//
//   node scripts/dev-test/check-slate.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const fakeEspn = require("./fake-espn");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-slate runs against a local database only");
const keep = process.argv.includes("--keep");
const DAY = 24 * 3600_000;
const NBA = "basketball/nba";
const SOCCER = "soccer/zt-slate";
const PREFIX = "zt-slate-";
const USER = "zt-slate-user";
const CARD = "mma/zt-slate-card";

const { pool } = jiti("../../src/lib/server/db.ts");
const { makeSlate, syncSlate, leagueSlates, SlateRefused } = jiti("../../src/lib/server/sports/slate.ts");
const { searchTeams, addSlate, MATCHUPS_A_DAY } = jiti("../../src/lib/server/sports/find.ts");
const { refreshSportsEvents } = jiti("../../src/lib/server/sports/matchup.ts");
const { linkSeason } = jiti("../../src/lib/server/sports/link.ts");
const { statsFromEvents } = jiti("../../src/lib/server/sports/stats.ts");
const { leagueGames } = jiti("../../src/lib/server/sports/score.ts");
const { sportLocks } = jiti("../../src/lib/server/air-times.ts");
const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");
const { easternDay } = jiti("../../src/lib/game/tv-listings.ts");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
/** The HTTP status an add is refused with, or "ok". */
const status = (p) => p.then(() => "ok", (e) => e.status ?? e.message);
const refusedWith = (p) => p.then(() => "ok", (e) => (e instanceof SlateRefused ? `refused: ${e.message}` : `threw: ${e.message}`));

async function down() {
  const shows = await pool.query("DELETE FROM shows WHERE sports_league LIKE $1 OR slug LIKE $1", [`${PREFIX}%`]);
  const events = await pool.query("DELETE FROM sports_events WHERE event_id LIKE 'zt-sl-%'");
  const cache = await pool.query("DELETE FROM sports_cache WHERE key LIKE $1", [`${PREFIX}standin:%`]);
  const user = await pool.query(`DELETE FROM "user" WHERE id = $1`, [USER]);
  return shows.rowCount + events.rowCount + cache.rowCount + user.rowCount;
}
/** The stand-in's answers asked again (the cache keeps a day's scoreboard an hour). */
const forget = () => pool.query("DELETE FROM sports_cache WHERE key LIKE $1", [`${PREFIX}standin:%`]);

(async () => {
  const gone = await down();
  if (gone) console.log(`(removed ${gone} rows a run before left)`);
  await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $1, $2, true, $1, $1, 'user', now(), now())`, [USER, `${USER}@example.invalid`]);
  const now = new Date();
  const today = easternDay(now);
  const day = (n) => easternDay(now, n);
  // A day's evening in the East (7 PM EST: midnight UTC), and ESPN's day (the Pacific's midnight: 08:00Z in winter).
  const at = (n, h = 0) => `${day(n + 1)}T${String(h).padStart(2, "0")}:00:00Z`;
  const espnDay = (n) => `${day(n)}T08:00Z`;
  const team = (n, league = NBA) => ({ id: `zt-sl-t${n}`, name: `ZT Slate ${n}s`, short: `${n}s`, location: `ZT Slate ${n}`, abbreviation: `ZS${n}`, league, roster: [{ id: `zt-sl-p${n}a`, name: `Slate Player ${n}A`, position: "G" }, { id: `zt-sl-p${n}b`, name: `Slate Player ${n}B`, position: "F" }] });
  const teams = [1, 2, 3, 4].map((n) => team(n));
  const fc = [1, 2, 3, 4].map((n) => ({ ...team(n, SOCCER), id: `zt-sl-f${n}`, name: `ZT Slate FC ${n}` }));
  const player = (t) => `${t.replace("-t", "-p")}a`;
  const box = (a, b) => ({ [a]: { labels: ["PTS"], rows: [{ id: player(a), name: "x", position: "G", stats: ["20"] }] }, [b]: { labels: ["PTS"], rows: [{ id: player(b), name: "y", position: "G", stats: ["11"] }] } });
  const game = (id, n, home, away, extra = {}) => ({ league: NBA, id: `zt-sl-${id}`, at: at(n, extra.hour ?? 0), home: `zt-sl-t${home}`, away: `zt-sl-t${away}`, state: n < 0 ? "post" : "pre", season: 2027, ...(n < 0 ? { score: [101, 99] } : {}), ...extra });
  const events = [
    game("g1", -1, 1, 2, { box: box("zt-sl-t1", "zt-sl-t2") }),
    game("g2", -1, 3, 4, { hour: 2, box: box("zt-sl-t3", "zt-sl-t4") }),
    // A doubleheader two days back: the same player in both.
    game("g3a", -2, 1, 2, { hour: 0, box: box("zt-sl-t1", "zt-sl-t2") }),
    game("g3b", -2, 1, 2, { hour: 3, box: box("zt-sl-t1", "zt-sl-t2") }),
    game("g4", 2, 2, 3),
    // Postponed yesterday (over, not completed); its makeup on the day off, four days on.
    game("g5", -1, 4, 1, { hour: 1, off: true, score: undefined }),
    game("g6", 4, 4, 1),
    game("g7", 20, 1, 3),
  ];
  const regularDays = [];
  for (let n = -10; n <= 30; n++) if (n !== 4) regularDays.push(n);
  const calendars = {
    [NBA]: {
      season: 2027,
      label: "2026-27",
      now: 2,
      stages: [
        { type: 1, name: "Preseason", from: espnDay(-30), to: `${day(-10)}T07:59Z` },
        { type: 2, name: "Regular Season", from: espnDay(-10), to: `${day(31)}T07:59Z` },
        { type: 3, name: "Postseason", from: espnDay(31), to: `${day(60)}T07:59Z` },
      ],
      days: [...regularDays, 32, 33, 34, 35, 36].map(espnDay),
    },
    [SOCCER]: { season: 2026, label: "2026-27 ZT Slate League", now: 77001, stages: [{ type: 77001, name: "2026-27 ZT Slate League", from: espnDay(-20), to: `${day(40)}T07:59Z` }], days: [] },
  };
  // The soccer league: two rounds of two, then a third with a match moved a day.
  const fixture = (id, n, h, a) => ({ league: SOCCER, id: `zt-sl-${id}`, at: at(n), home: `zt-sl-f${h}`, away: `zt-sl-f${a}`, state: n < 0 ? "post" : "pre", season: 2026, ...(n < 0 ? { score: [1, 0] } : {}) });
  events.push(fixture("s1", -6, 1, 2), fixture("s2", -6, 3, 4), fixture("s3", 1, 1, 3), fixture("s4", 2, 2, 4), fixture("s5", 9, 1, 4), fixture("s6", 9, 2, 3));
  const espn = await fakeEspn.start({ teams: [...teams, ...fc], leagues: [{ league: SOCCER, name: "ZT Slate League", short: "ZT Slate" }, { league: CARD, name: "ZT Slate Fight Night" }], events, calendars });
  const providers = sportsProviders({ base: espn.url, prefix: `${PREFIX}standin:` });
  const opts = { providers, prefix: PREFIX, now };
  const links = async (id) => (await pool.query("SELECT episode, event_id, starts_at FROM season_events WHERE season_id = $1 ORDER BY episode, event_id", [id])).rows;
  const epOf = async (id, event) => (await pool.query("SELECT episode FROM season_events WHERE season_id = $1 AND event_id = $2", [id, event])).rows[0]?.episode ?? null;
  const monday = (n) => {
    const d = new Date(`${day(n)}T12:00:00Z`).getUTCDay();
    return easternDay(new Date(Date.parse(`${day(n)}T12:00:00Z`) - ((d + 6) % 7) * DAY));
  };
  const ep = async (id, n) => (await pool.query("SELECT number, air_at, title FROM season_episodes WHERE season_id = $1 AND number = $2", [id, n])).rows[0];
  try {
    // What a league's slate can be, before any's made.
    const mondays = new Set(regularDays.map((n) => monday(n))).size;
    const nba = await leagueSlates(NBA, opts);
    const reg = nba?.stages.find((x) => x.stage === "regular");
    const po = nba?.stages.find((x) => x.stage === "post");
    check(nba?.slate === true && nba.leagueName === "NBA" && nba.season?.year === 2027 && nba.season.words === "2026-27" && nba.usual?.stage === "regular" && nba.usual.cadence === "week", "a league's slates: its season now and what an add makes unless it says", JSON.stringify(nba && { ...nba, stages: undefined }));
    check(reg?.state === "now" && reg.from === day(-10) && reg.to === day(30) && po?.state === "coming" && po.from === day(31), "its stages, their days, past, now or coming", JSON.stringify([reg && { ...reg, slates: undefined }, po && { ...po, slates: undefined }]));
    check(
      JSON.stringify(reg?.slates) === JSON.stringify([{ stage: "regular", cadence: "week", usual: true, name: "NBA 2026-27", episodes: mondays, seasonId: null }, { stage: "regular", cadence: "day", usual: false, name: "NBA 2026-27, day by day", episodes: regularDays.length, seasonId: null }]),
      "each cut each way, named, its episodes, none made yet",
      JSON.stringify(reg?.slates)
    );
    check(po?.slates.find((x) => x.cadence === "day")?.episodes === 5 && po.slates[0].name === "NBA 2026-27 playoffs", "the playoffs' from ESPN's days", JSON.stringify(po?.slates));
    const before = espn.asked.length;
    const soccer = await leagueSlates(SOCCER, opts);
    check(soccer?.usual?.cadence === "round" && soccer.stages[0]?.slates[0]?.episodes === 3 && soccer.leagueName === "ZT Slate", "a soccer league's rounds counted from its fixtures", JSON.stringify(soccer));
    check(espn.asked.slice(before).some((a) => /scoreboard\?dates=\d{6}&/.test(a)), "its fixtures read a month at a time");
    const tour = await leagueSlates("golf/pga", opts);
    check(tour?.slate === false && tour.stages.length === 0 && tour.usual === null, "a tour's league: no slate", JSON.stringify(tour));
    check((await leagueSlates("basketball/zt-nothing", opts)) === null && (await leagueSlates("curling/zt-none", opts)) === null, "no such league: none");

    // Found by name.
    const asked = espn.asked.length;
    const byList = await searchTeams("nba", { ...opts, leagues: [NBA] });
    check(byList.leagues.length === 1 && byList.leagues[0].league === NBA && byList.leagues[0].leagueName === "NBA" && byList.leagues[0].slate === true && byList.leagues[0].score === 100, "a league by its list's names", JSON.stringify(byList.leagues));
    check(!espn.asked.slice(asked).some((a) => a.startsWith("/apis/search/v2")), "ESPN's search not asked when a list names it");
    const bySearch = await searchTeams("zt slate league", { ...opts, leagues: [NBA] });
    check(bySearch.leagues.length === 1 && bySearch.leagues[0].league === SOCCER && bySearch.leagues[0].leagueName === "ZT Slate" && bySearch.leagues[0].name === "ZT Slate League" && bySearch.leagues[0].slate && bySearch.teams.length === 0, "a league through ESPN's search, named as its list names it", JSON.stringify(bySearch));
    const card = await searchTeams("zt slate fight", { ...opts, leagues: [NBA] });
    check(card.leagues.length === 1 && card.leagues[0].league === CARD && card.leagues[0].slate === false && card.leagues[0].leagueName === "ZT Slate Fight Night", "a promotion's league: found, no slate", JSON.stringify(card.leagues));

    // Made by day.
    const s = await makeSlate({ ...opts, league: NBA, cadence: "day" });
    const stageDays = regularDays.length;
    check(s?.made === true && s.cadence === "day" && s.stage === "regular" && s.episodes === stageDays, "made by day: an episode each of ESPN's days in the stage", JSON.stringify(s));
    check(s?.name === "NBA 2026-27, day by day", "named", s?.name);
    const l = await links(s.seasonId);
    const ids = l.map((x) => x.event_id).sort();
    check(ids.join() === ["zt-sl-g1", "zt-sl-g2", "zt-sl-g3a", "zt-sl-g3b", "zt-sl-g4", "zt-sl-g5", "zt-sl-g6"].join() && s.games === 7, "the games from three days back to eight ahead linked, three weeks on not yet", ids.join());
    const yest = await epOf(s.seasonId, "zt-sl-g1");
    check(yest === 10 && (await epOf(s.seasonId, "zt-sl-g2")) === 10 && (await epOf(s.seasonId, "zt-sl-g5")) === 10, "a day's games (and its postponed one) in its episode", String(yest));
    check((await epOf(s.seasonId, "zt-sl-g3a")) === 9 && (await epOf(s.seasonId, "zt-sl-g3b")) === 9, "a doubleheader's two in one day's episode");
    // Day 4 is off: its makeup belongs to day 5's episode (day -10 is episode 1; day 3 is 14; day 5 is 15).
    check((await epOf(s.seasonId, "zt-sl-g6")) === 15, "a makeup on a day off: the next day's episode", String(await epOf(s.seasonId, "zt-sl-g6")));
    const e10 = await ep(s.seasonId, 10);
    check(e10?.air_at.toISOString() === new Date(at(-1, 0)).toISOString() && e10.title.length > 0, "each episode's air time its first game's start", JSON.stringify(e10));
    const e20 = await ep(s.seasonId, 20);
    check(e20?.air_at.toISOString() === new Date(`${day(10)}T05:00:00Z`).toISOString(), "an episode with no games linked yet airs at its day's start in the East", e20?.air_at.toISOString());
    const meta = (await pool.query("SELECT x.key, x.cadence, s.sports_league, s.name AS show, ss.status, (SELECT count(*)::int FROM sports_events f WHERE f.event_id LIKE 'zt-sl-g%') AS facts FROM sports_slates x JOIN show_seasons ss ON ss.id = x.season_id JOIN shows s ON s.id = ss.show_id WHERE x.season_id = $1", [s.seasonId])).rows[0];
    check(meta?.key === `${PREFIX}espn:${NBA}:slate:2027:regular:day` && meta.sports_league === `${PREFIX}espn:${NBA}` && meta.status === "airing" && meta.facts === 7, "its key, the league's show, its status, its games' facts kept", JSON.stringify(meta));
    const listing = await linkSeason(s.seasonId, { providers, now });
    check(listing.added === 0 && (await links(s.seasonId)).length === 7, "the listings' linking leaves it alone", JSON.stringify(listing));
    const cast = (await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [s.seasonId])).rows[0].n;
    check(cast === 8, "its people: the linked teams' rosters", String(cast));
    const again = await makeSlate({ ...opts, league: NBA, cadence: "day" });
    check(again?.made === false && again.seasonId === s.seasonId && again.games === 7, "asked again: found", JSON.stringify(again));

    // By week, by round, the playoffs.
    const w = await makeSlate({ ...opts, league: NBA });
    const wk = (await pool.query("SELECT windows FROM sports_slates WHERE season_id = $1", [w?.seasonId])).rows[0]?.windows ?? [];
    check(w?.made && w.cadence === "week" && w.name === "NBA 2026-27" && wk[0]?.[0] === monday(-10) && wk.every(([f, t]) => new Date(`${f}T12:00:00Z`).getUTCDay() === 1 && new Date(`${t}T12:00:00Z`).getUTCDay() === 0), "by week (its usual): its own season, Monday to Sunday", JSON.stringify({ w, first: wk[0] }));
    check((await epOf(w.seasonId, "zt-sl-g1")) === (await epOf(w.seasonId, "zt-sl-g3a")) || monday(-1) !== monday(-2), "a week's games in one episode");
    check(/^refused: It goes by week or day/.test(await refusedWith(makeSlate({ ...opts, league: NBA, cadence: "round" }))), "by round: refused");
    const post = await makeSlate({ ...opts, league: NBA, stage: "post", cadence: "day" });
    check(post?.made && post.episodes === 5 && post.games === 0 && post.name === "NBA 2026-27 playoffs, day by day", "the playoffs: ESPN's days, no games listed yet", JSON.stringify(post));
    espn.events.push(game("p1", 38, 1, 2, { stage: "post" }));
    const grew = await syncSlate(post.seasonId, { providers, now, days: [day(38)], cast: false });
    const pc = (await pool.query("SELECT episode_count FROM show_seasons WHERE id = $1", [post.seasonId])).rows[0].episode_count;
    check(grew.appended === 1 && grew.added === 1 && pc === 6 && (await epOf(post.seasonId, "zt-sl-p1")) === 6, "a playoff game past its last day: an episode after it", JSON.stringify({ grew, pc }));
    check((await epOf(s.seasonId, "zt-sl-p1")) === null, "the playoffs' game in no regular season's episode");

    // Kept current.
    espn.events.find((e) => e.id === "zt-sl-g4").at = at(3);
    espn.events.push(game("g8", 6, 3, 1));
    await forget();
    const sync = await syncSlate(s.seasonId, { providers, now, cast: false });
    check(sync.moved === 1 && (await epOf(s.seasonId, "zt-sl-g4")) === 14, "a game moved to another day: moved to its episode", JSON.stringify(sync));
    check(sync.added === 1 && (await epOf(s.seasonId, "zt-sl-g8")) === 16, "a game listed later: linked", String(await epOf(s.seasonId, "zt-sl-g8")));
    const far = await syncSlate(s.seasonId, { providers, now, days: [day(20)], cast: false });
    check(far.added === 1 && (await epOf(s.seasonId, "zt-sl-g7")) === 30, "a game three weeks on linked once its day's read", JSON.stringify(far));
    const job = await refreshSportsEvents({ providers, now, only: [s.seasonId] });
    check(!job.errors.some((e) => /slate/.test(e)), "the daily job syncs it first, without errors", job.errors.join("; "));

    // Read.
    const locks = await sportLocks(pool, s.seasonId, "daily");
    check(locks.get(10) === new Date(at(-1, 0)).toISOString(), "a day's lock at its first game", locks.get(10));
    await statsFromEvents(s.seasonId, { providers, now });
    const lines = (await pool.query("SELECT episode, event_id FROM game_lines WHERE season_id = $1 AND athlete = 'zt-sl-p1a' AND episode > 0 ORDER BY event_id", [s.seasonId])).rows;
    check(lines.map((x) => `${x.episode}:${x.event_id}`).join() === "10:zt-sl-g1,9:zt-sl-g3a,9:zt-sl-g3b", "the Players tab's lines a game each: the doubleheader's two for one player", JSON.stringify(lines));
    // Two finals kept for yesterday's games (as finals.ts keeps them), read by leagueGames.
    const kept = (id, a, b) =>
      pool.query("UPDATE sports_events SET final = true, state = 'post', lines = $2, people = $3 WHERE event_id = $1", [
        id,
        JSON.stringify({ [`${a}a`]: { PTS: 20, FGM: 8, FGA: 16 }, [`${b}a`]: { PTS: 11, FGM: 4, FGA: 10 } }),
        JSON.stringify({ [`${a}a`]: { team: a.replace("p", "t"), position: "G" }, [`${b}a`]: { team: b.replace("p", "t"), position: "G" } }),
      ]);
    await kept("zt-sl-g1", "zt-sl-p1", "zt-sl-p2");
    await kept("zt-sl-g2", "zt-sl-p3", "zt-sl-p4");
    const show = (await pool.query("SELECT s.slug, ss.season_number FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [s.seasonId])).rows[0];
    const people = (await pool.query("SELECT name FROM season_cast WHERE season_id = $1", [s.seasonId])).rows;
    const castaways = people.map((p, i) => ({ id: `c${i}`, name: p.name }));
    const lg = await leagueGames({ settings: { showId: show.slug, wikiSeason: show.season_number }, castaways }, { now });
    const one = castaways.find((c) => c.name === "Slate Player 1A").id;
    check(lg?.slate.get(10)?.size === 3 && lg.slate.get(10).get("zt-sl-g1")?.status === "final" && lg.slate.get(10).get("zt-sl-g5")?.status === "off", "an episode of several games: each one's facts apart (final, final, postponed)", JSON.stringify([...(lg?.slate.get(10)?.entries() ?? [])].map(([k, v]) => [k, v.status])));
    check(lg?.byGame.get(10)?.size === 2 && lg.byGame.get(10).get("zt-sl-g1")?.[one]?.PTS === 20, "each final game's lines apart", JSON.stringify([...(lg?.byGame.get(10)?.keys() ?? [])]));
    check(Object.keys(lg?.lines.get(10) ?? {}).length === 4 && lg.lines.get(10)[one]?.PTS === 20, "the episode's lines: its final games' added up", JSON.stringify(lg?.lines.get(10)));
    check(lg?.games.size === 0 && lg.sides.size === 0 && lg.slate.get(14)?.size === 1, "a slate's every episode in `slate` (day 3's one game too: its shape never changes as more are linked); `games` and `sides` none", JSON.stringify({ games: lg?.games.size, g14: lg?.slate.get(14)?.size }));

    // What it can be once made: the seasons made for it, the playoffs' grown.
    const madeNow = await leagueSlates(NBA, opts);
    const opt = (stage, cadence) => madeNow?.stages.find((x) => x.stage === stage)?.slates.find((x) => x.cadence === cadence);
    check(opt("regular", "day")?.seasonId === s.seasonId && opt("regular", "week")?.seasonId === w.seasonId && opt("post", "day")?.seasonId === post.seasonId && opt("post", "day").episodes === 6 && opt("post", "week")?.seasonId === null, "the seasons made for them, the playoffs' grown", JSON.stringify(madeNow?.stages));

    // Added (POST /api/sports/add's slate).
    const followed = async (id) => (await pool.query("SELECT following FROM show_follows WHERE season_id = $1 AND user_id = $2", [id, USER])).rows[0]?.following === true;
    const add = (slate, league = NBA) => addSlate(USER, { league, slate }, { providers, prefix: PREFIX, now, cast: false });
    const found = await add({ cadence: "day" });
    check(found.made === false && found.seasonId === s.seasonId && found.episodes === stageDays && (await followed(s.seasonId)), "one made: found, and followed", JSON.stringify(found));
    const pw = await add({ stage: "post", cadence: "week" }, "BASKETBALL/NBA");
    const by = (await pool.query("SELECT made_by, league FROM sports_slates WHERE season_id = $1", [pw.seasonId])).rows[0];
    check(pw.made && pw.name === "NBA 2026-27 playoffs" && pw.stage === "post" && pw.cadence === "week" && pw.league === NBA && by?.made_by === USER && by.league === NBA && (await followed(pw.seasonId)), "a new one (a league in capitals): made by them, and followed", JSON.stringify({ pw, by }));
    check((await status(add({ cadence: "round" }))) === 400, "a cadence it isn't cut by: 400");
    check((await status(add({ stage: "pre" }))) === 400 && (await status(add({ cadence: "month" }))) === 400, "a stage or cadence that isn't one: 400");
    check((await status(addSlate(USER, { league: NBA }, opts))) === 400 && (await status(addSlate(USER, null, opts))) === 400 && (await status(add({}, "not a league"))) === 400, "no slate, no ask, no league: 400");
    check((await status(add({}, "golf/pga"))) === 400, "a tour's league: 400");
    check((await status(add({}, "basketball/zt-nothing"))) === 404, "no such league: 404");
    // The day's cap, counted with matchups: theirs so far one slate; matchups made up to the cap.
    const showId = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [s.seasonId])).rows[0].show_id;
    await pool.query(
      `WITH ss AS (INSERT INTO show_seasons (show_id, season_number, name, status) SELECT $1, 900 + g, 'zt cap', 'upcoming' FROM generate_series(1, $2::int) g RETURNING id, season_number)
       INSERT INTO sports_matchups (season_id, provider, league, events, key, made_by) SELECT id, 'espn', $3, ARRAY['zt-sl-cap'], $4 || season_number, $5 FROM ss`,
      [showId, MATCHUPS_A_DAY - 1, NBA, `${PREFIX}cap-`, USER]
    );
    check((await status(add({}, SOCCER))) === 429, `the day's cap: ${MATCHUPS_A_DAY} made (a slate and matchups), the next refused`);

    // A soccer league by round.
    const r = await makeSlate({ ...opts, league: SOCCER });
    const rl = await links(r?.seasonId);
    const rounds = new Map();
    for (const x of rl) rounds.set(x.episode, [...(rounds.get(x.episode) ?? []), x.event_id.slice(6)]);
    check(r?.made && r.cadence === "round" && r.episodes === 3 && r.games === 6 && r.name === "ZT Slate 2026-27", "a soccer league by round: its fixtures month by month, all linked at once", JSON.stringify({ r, rounds: [...rounds] }));
    check([...rounds.values()].map((x) => x.sort().join("+")).join() === "s1+s2,s3+s4,s5+s6", "each team once a round", JSON.stringify([...rounds]));
    check(espn.asked.some((a) => /scoreboard\?dates=\d{6}&/.test(a)), "read a month at a time");
    check(/^refused: It goes by round or day/.test(await refusedWith(makeSlate({ ...opts, league: SOCCER, cadence: "week" }))), "a soccer league by week: refused");
    const free = await add({}, SOCCER);
    check(free.made === false && free.seasonId === r.seasonId && (await followed(r.seasonId)), "one made is still added past the cap", JSON.stringify(free));
    check((await makeSlate({ ...opts, league: "basketball/zt-nothing" })) === null, "no such league: none");
  } finally {
    await espn.close();
    if (!keep) console.log(`(removed ${await down()} rows)`);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
