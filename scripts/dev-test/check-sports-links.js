// Dev-only check of a sport's sports data: its episodes linked to the provider's games (src/lib/server/sports/link.ts,
// src/lib/game/sports-match.ts; docs/PLAN-sports-data.md step 2; db/migrations/0148), its people from them (sports/cast.ts,
// sports/season.ts, rosters.ts; step 3; 0149) and their stats from the games' box scores (sports/stats.ts,
// src/lib/game/sports-stats.ts, rosters.ts; step 4; 0150). By default no app server: it calls the app's own code through jiti.
//
// By default, on stand-ins: fake-listings.js's World Series ("Game 1: ZT Rays at ZT Brewers" and on, made into a season by the
// app's own listedSeason, so its titles and air times are written as Add a show writes them) and fake-espn.js, whose search has
// ZT Rays in two leagues (baseball's and a football decoy) and the show's name matching a third (a little-league decoy):
//   linking: the season lands in baseball's league (its search votes and scoreboards, not the decoys); Games 1-4 link to their
//   games by both teams' names; "Game 5" (no names) takes that day's game between the series' teams; Game 6 isn't on the stand-in
//   yet (unmatched, said so, looked at again the next day) and Game 7, three weeks out, isn't due; nothing's linked twice; a run
//   with nothing new asks the stand-in nothing (the cache); Game 6 links once it's scheduled; a listing that moves Game 2 onto
//   Game 3's day doesn't take Game 3's game, and moving it back links it again; the stand-in down stops a run with what's linked
//   kept and looks again an hour on; the daily job's part (linkSportSeasons) looks only at seasons with games due; a show that
//   isn't a sport is left alone; a sport no provider has says so and waits a week.
//   its people: both teams' players from their rosters (never the manager), team by team, each with position, headshot and
//   ESPN's id, Wikipedia looked in for the one without a headshot (initials when it finds none); nobody twice when it runs again;
//   the Players tab's read credits ESPN and offers no Fill in who's playing; a game's cast and one filled in another way are left
//   alone. A footy season whose teams have no rosters (as ESPN's AFL comes back) gets its players from the linked games' box
//   scores, through the Players tab's own read (which links it first), held back until you've seen the game that brought them, a
//   team that hasn't played yet waiting for its first game, and when that game's played its players (and a new one of a team
//   already in) come in. A race's season gets its field, by name. Fill in who's playing asks the sports data first: a series
//   nobody linked yet is linked and filled at once, no bot.
//   their stats: Games 1-3's box scores (batting and pitching tables, as ESPN's) and everyone's 2026 regular season, its
//   postseason left out, in 3 box scores and 7 season lines, and nothing asked again; through the guard, nothing at mark 0 but
//   coming in, so far added up through the mark (H-AB as a pair, IP never summed) and a later game's said to be waiting; a live
//   Game 4 read, not again for ten minutes, then final; a game moved off its link loses its lines and gets them back; the Players
//   tab's own read fills what's due; a footy season's rounds added up; a race's places.
// --real: the REAL 2026 World Series from the REAL TVmaze (show 20637) against the REAL ESPN, as an archived copy keyed
//   "zt-sports-": Game 1 is ESPN's 401908042, every game that has aired is linked to the game its title names, a second run asks
//   ESPN nothing, and its people are both teams' players with ESPN's headshots and ids, never a manager; then their stats from
//   Games 1-3's box scores and the 2026 regular season (Yandy Díaz's 0-4 in Game 1, 2-13 through Game 3, .293 coming in, not his
//   postseason), through the guard, and nothing asked again.
// --server (needs `npm run dev`): the way the app does it, as a throwaway user zt_sports. It adds the real World Series through
//   POST /api/me/shows: its season is linked and its people filled in after the answer (add-show.ts linkLater), and the Players
//   tab (GET /api/seasons/[id]/roster, then the page itself at --width, 390 by default, with a screenshot to --shots) shows both
//   teams' players with ESPN's headshots and credits ESPN, as Settings › Credits does; with zt_sports at Game 2, each player's
//   two stat lines (so far through Game 2, coming in) at that width (a screenshot). Then, on stand-ins (fake listings, an ESPN
//   with nothing, fake-bot.js), a sport ESPN hasn't got: the tab's read looks for it on ESPN, then offers Fill in who's playing,
//   which asks the stand-in ESPN once more and then the bot, whose answer is the roster. Skipped when this database already has
//   the World Series (a real show is never touched).
//
//   node scripts/dev-test/check-sports-links.js [--real | --server [--width=390] [--shots=<dir>]] [--keep]
//
// Every row it makes is keyed "zt-sports-" (shows, and through them seasons, episodes, links and people; cache rows "zt-sports"
// and "zt-standin:"), or made by zt_sports; it removes them at the end (--keep leaves them; the next run removes them first).
// Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const fakeListings = require("./fake-listings");
const fakeEspn = require("./fake-espn");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-sports-links runs against a local database only");

const args = process.argv.slice(2);
const real = args.includes("--real");
const server = args.includes("--server");
const keep = args.includes("--keep");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const shots = (args.find((a) => a.startsWith("--shots=")) || `--shots=${path.join(os.tmpdir(), "check-sports-links")}`).slice(8);
const USER = "zt_sports";
const PASSWORD = "zt-pass-12345";
const WORLD_SERIES = 20637;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const { pool } = jiti("../../src/lib/server/db.ts");
const { listedSeason } = jiti("../../src/lib/server/add-show.ts");
const { showListing } = jiti("../../src/lib/server/listings.ts");
const { linkSeason } = jiti("../../src/lib/server/sports/link.ts");
const { followSeason, linkSportSeasons } = jiti("../../src/lib/server/sports/season.ts");
const { castFromEvents, FIELD } = jiti("../../src/lib/server/sports/cast.ts");
const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");
const { espn } = jiti("../../src/lib/server/sports/espn.ts");
const { withCache } = jiti("../../src/lib/server/sports/cache.ts");
const { rosterOf, askRoster } = jiti("../../src/lib/server/rosters.ts");
const { statsFromEvents, statsDue } = jiti("../../src/lib/server/sports/stats.ts");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

let serverStart = null;
async function down() {
  const { rowCount } = await pool.query("DELETE FROM shows WHERE slug LIKE 'zt-sports-%'");
  const cache = await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-sports%' OR key LIKE 'zt-standin:%'");
  // zt_sports's: the shows it added (--server), the user and their settings (their follows go with their seasons), and in --server
  // the real ESPN's cache rows written while it ran.
  const made = await pool.query(`DELETE FROM shows WHERE created_by IN (SELECT id FROM "user" WHERE username = $1)`, [USER]);
  await pool.query(`DELETE FROM user_settings WHERE user_id IN (SELECT id FROM "user" WHERE username = $1)`, [USER]);
  await pool.query(`DELETE FROM show_follows WHERE user_id IN (SELECT id FROM "user" WHERE username = $1)`, [USER]);
  await pool.query(`DELETE FROM "user" WHERE username = $1`, [USER]);
  const served = serverStart ? await pool.query("DELETE FROM sports_cache WHERE key LIKE 'espn:%' AND fetched_at >= $1", [serverStart]) : { rowCount: 0 };
  return `${rowCount + made.rowCount} shows, ${cache.rowCount + served.rowCount} cache rows`;
}

/** The throwaway user (approved, as a raw insert is); with a password when it signs in through the dev server. */
async function makeUser(withPassword) {
  const userId = randomUUID();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'user', now(), now())`,
    [userId, USER, `${USER}@example.invalid`]
  );
  if (withPassword) {
    const { hashPassword } = await import("better-auth/crypto");
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [randomUUID(), userId, await hashPassword(PASSWORD)]);
  }
  return userId;
}

async function sportShow(slug, name, kind = "sport") {
  // Not a game yet (set_up_at NULL), as a show added from the TV listings is.
  const { rows } = await pool.query(
    `INSERT INTO shows (slug, name, castaway_term, tribe_term, kind, archived, episode_term, set_up_at) VALUES ($1, $2, 'Player', 'Team', $3, true, 'Game', NULL) RETURNING id`,
    [slug, name, kind]
  );
  return rows[0].id;
}

/** A season with episodes written directly (no listing): [{ days | at, title }]. */
async function plainSeason(showId, episodes) {
  const { rows } = await pool.query("INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 1, 'airing') RETURNING id", [showId]);
  for (const [i, e] of episodes.entries()) {
    await pool.query("INSERT INTO season_episodes (season_id, number, air_at, title, source) VALUES ($1, $2, $3, $4, 'listing')", [rows[0].id, i + 1, e.at ? new Date(e.at) : new Date(Date.now() + e.days * DAY), e.title]);
  }
  return rows[0].id;
}

const linksOf = async (seasonId) => (await pool.query("SELECT * FROM season_events WHERE season_id = $1 ORDER BY episode", [seasonId])).rows;
const stateOf = async (seasonId) => (await pool.query("SELECT * FROM sports_links WHERE season_id = $1", [seasonId])).rows[0];
const castOf = async (seasonId) => (await pool.query("SELECT name, tribe_name, role, photo_url, provider_ids FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [seasonId])).rows;
const hoursTo = (t, from = Date.now()) => (t.getTime() - from) / HOUR;
const sizes = (roster) => Object.fromEntries(roster.groups.map((g) => [g.name, g.people.length]));
const shot = (n) => `https://a.espncdn.com/i/headshots/zt/${n}.png`;
/** How a headshot is stored: at a face's size, through ESPN's resizer (espn.ts sizedHeadshot). */
const stored = (n) => `https://a.espncdn.com/combiner/i?img=/i/headshots/zt/${n}.png&w=160&h=160&scale=crop`;
/** Someone's mark on a season (what they've seen). */
const markAt = (userId, seasonId, n) =>
  pool.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = $3", [userId, seasonId, n]);
/** One of someone's stat lines on the Players tab, as it reads ("2-13 H-AB · 1 R"); null when they have none. */
function statLine(roster, name, part) {
  const items = roster.groups.flatMap((g) => g.people).find((x) => x.name === name)?.stats?.[part];
  return items ? items.map((i) => (i.label ? `${i.value} ${i.label}` : i.value)).join(" · ") : null;
}
const BAT = ["H-AB", "AB", "R", "H", "RBI", "HR", "BB", "K", "#P", "AVG", "OBP", "SLG"];
const PITCH = ["IP", "H", "R", "ER", "BB", "K", "HR", "PC-ST", "ERA", "PC"];

async function standIn() {
  const now = Date.now();
  const games = [
    { days: -4, title: "Game 1: ZT Rays at ZT Brewers" },
    { days: -3, title: "Game 2: ZT Rays at ZT Brewers" },
    { days: -1, title: "Game 3: ZT Brewers at ZT Rays" },
    { days: 0, title: "Game 4: ZT Brewers at ZT Rays" },
    { days: 1, title: "Game 5" },
    { days: 3, title: "Game 6: ZT Rays at ZT Brewers (if necessary)" },
    { days: 20, title: "Game 7: ZT Rays at ZT Brewers (if necessary)" },
  ];
  const ws = fakeListings.worldSeries(games, { now });
  const tv = await fakeListings.start({ shows: [...fakeListings.shows(now), ws] });
  const stamp = (n) => ws.seasons[0].episodes.find((e) => e.number === n).airstamp;
  const team = (id, name, short, location, abbreviation, roster = [], league = "baseball/zt-mlb") => ({ id, name, short, location, abbreviation, league, roster });
  const p = (id, name, position, headshot = true) => ({ id, name, position, ...(headshot ? { headshot: shot(id) } : {}) });
  const game = (id, n, home, away, state, score, box) => ({ league: "baseball/zt-mlb", id, at: stamp(n), home, away, state, score, note: `ZT World Series - Game ${n}`, stage: "post", box });
  // Each game's box score, in ESPN's tables: { [team]: [batting rows, pitching rows] }, a row [id, name, stats].
  const box = (sides) =>
    Object.fromEntries(
      Object.entries(sides).map(([team, [bat, pitch]]) => [
        team,
        { tables: [{ name: "batting", labels: BAT, rows: bat.map(([id, name, stats]) => ({ id, name, stats })) }, { name: "pitching", labels: PITCH, rows: pitch.map(([id, name, stats]) => ({ id, name, stats })) }] },
      ])
    );
  const b = (hab, r, rbi, hr, bb, k, np) => [hab, hab.split("-")[1], String(r), hab.split("-")[0], String(rbi), String(hr), String(bb), String(k), String(np), ".250", ".300", ".400"];
  const BOX1 = box({ 30: [[["r1", "ZT Pat Utility", b("1-4", 0, 0, 0, 0, 1, 15)], ["r3", "ZT Lee Catcher", b("0-3", 0, 0, 0, 1, 2, 14)], ["r4", "ZT Kim Slugger", b("2-4", 1, 2, 1, 0, 0, 18)]], [["r2", "ZT Sam Ace", ["6.0", "5", "3", "3", "1", "7", "1", "90-60", "4.50", "90"]]]], 8: [[["b2", "ZT Ash Shortstop", b("1-4", 1, 1, 0, 0, 1, 16)]], [["b1", "ZT Jo Closer", ["1.0", "0", "0", "0", "0", "2", "0", "14-10", "0.00", "14"]]]] });
  const BOX2 = box({ 30: [[["r4", "ZT Kim Slugger", b("1-4", 1, 0, 0, 1, 1, 20)]], []], 8: [[["b3", "ZT Max Outfield", b("2-4", 1, 1, 1, 0, 0, 17)]], []] });
  const BOX3 = box({ 30: [[["r4", "ZT Kim Slugger", b("0-3", 0, 0, 0, 0, 2, 12)]], []], 8: [[["b3", "ZT Max Outfield", b("1-3", 0, 0, 0, 1, 1, 11)]], [["b1", "ZT Jo Closer", ["0.2", "1", "1", "1", "1", "0", "0", "18-11", "6.75", "18"]]]] });
  const SEASON_BAT = ["GP", "AB", "R", "H", "HR", "RBI", "BB", "SO", "AVG", "OBP", "SLG", "WAR"];
  const SEASON_PITCH = ["GP", "GS", "W", "L", "ERA", "WHIP", "IP", "K", "BB", "H", "R", "ER"];
  const seasons = {
    r4: [
      { year: 2026, name: "career-batting", displayName: "Career Batting", labels: SEASON_BAT, stats: ["150", "560", "88", "160", "35", "101", "70", "140", ".286", ".370", ".540", "5.1"] },
      { year: 2025, name: "career-batting", displayName: "Career Batting", labels: SEASON_BAT, stats: ["140", "500", "70", "130", "25", "80", "60", "130", ".260", ".340", ".480", "3.0"] },
      { year: 2026, name: "postseason-batting", displayName: "Postseason Batting", labels: SEASON_BAT, stats: ["10", "40", "5", "12", "3", "8", "4", "9", ".300", ".370", ".600", "--"] },
    ],
    r2: [{ year: 2026, name: "pitching", displayName: "pitching", labels: SEASON_PITCH, stats: ["30", "30", "14", "8", "3.40", "1.10", "180.2", "200", "45", "150", "72", "68"] }],
    b1: [{ year: 2026, name: "pitching", displayName: "pitching", labels: SEASON_PITCH, stats: ["70", "0", "5", "3", "2.10", "0.95", "68.1", "80", "20", "45", "18", "16"] }],
    b3: [{ year: 2026, name: "career-batting", displayName: "Career Batting", labels: SEASON_BAT, stats: ["120", "400", "60", "110", "12", "50", "40", "90", ".275", ".340", ".420", "2.2"] }],
  };
  const AFL = "australian-football/zt-afl";
  const sb = await fakeEspn.start({
    seasons,
    teams: [
      team("30", "ZT Rays", "Rays", "ZT Bay", "ZTR", [p("r1", "ZT Pat Utility", "Infielder", false), p("r2", "ZT Sam Ace", "Starting Pitcher"), p("r3", "ZT Lee Catcher", "Catcher"), p("r4", "ZT Kim Slugger", "Designated Hitter")]),
      team("8", "ZT Brewers", "Brewers", "ZT Milwaukee", "ZTB", [p("b1", "ZT Jo Closer", "Relief Pitcher"), p("b2", "ZT Ash Shortstop", "Shortstop"), p("b3", "ZT Max Outfield", "Center Fielder")]),
      team("16", "ZT Cubs", "Cubs", "ZT Chicago", "ZTC", [p("c1", "ZT Cub One", "Pitcher"), p("c2", "ZT Cub Two", "Catcher")]),
      team("21", "ZT Mets", "Mets", "ZT New York", "ZTM", [p("m1", "ZT Met One", "Pitcher"), p("m2", "ZT Met Two", "First Baseman")]),
      team("9030", "ZT Rays", "Rays", "ZT Bay", "ZRF", [], "football/zt-nfl"),
      team("9003", "ZT Bears", "Bears", "ZT Chicago", "ZBF", [], "football/zt-nfl"),
      // Footy: no rosters, as ESPN's AFL comes back.
      team("501", "ZT Dockers", "Dockers", "ZT Fremantle", "ZFR", [], AFL),
      team("502", "ZT Lions", "Lions", "ZT Brisbane", "ZBL", [], AFL),
      team("503", "ZT Swans", "Swans", "ZT Sydney", "ZSY", [], AFL),
    ],
    leagues: [
      { league: "baseball/zt-little", name: "ZT Little League World Series" },
      { league: "racing/zt-f1", name: "ZT Racing Series" },
    ],
    events: [
      game("ws1", 1, "8", "30", "post", [3, 2], BOX1),
      game("ws2", 2, "8", "30", "post", [1, 4], BOX2),
      game("ws3", 3, "30", "8", "post", [0, 7], BOX3),
      game("ws4", 4, "30", "8", "pre"),
      game("ws5", 5, "30", "8", "pre"),
      // The same evening as Game 1: another baseball game, and a football game with a Rays of its own.
      { league: "baseball/zt-mlb", id: "decoy1", at: new Date(Date.parse(stamp(1)) - 3 * HOUR).toISOString(), home: "21", away: "16", state: "post", score: [5, 1] },
      { league: "football/zt-nfl", id: "decoy2", at: stamp(1), home: "9003", away: "9030", state: "post", score: [20, 17] },
    ],
  });
  const at = (ms = 0) => ({ providers: [withCache(espn(sb.url), { prefix: "zt-sports:", now: () => now + ms })], now: new Date(now + ms) });
  try {
    console.log("== the stand-in World Series: linking (step 2)");
    const showId = await sportShow("zt-sports-ws", "ZT World Series");
    const listing = await showListing(ws.show.id, tv.url);
    const seasonId = await listedSeason(showId, listing.show, listing.seasons[0], tv.url, new Date(now), null);
    const { rows: eps } = await pool.query("SELECT number, title FROM season_episodes WHERE season_id = $1 ORDER BY number", [seasonId]);
    check(eps.length === 7 && eps[0].title === games[0].title, "the listing's seven games are the season's episodes (its pregame specials aren't)", JSON.stringify(eps));

    let r = await linkSeason(seasonId, at());
    let links = await linksOf(seasonId);
    const byEp = Object.fromEntries(links.map((l) => [l.episode, l]));
    check(r.provider === "espn" && r.league === "baseball/zt-mlb", "its league: baseball's, not the football or little-league decoys", JSON.stringify(r));
    check(["ws1", "ws2", "ws3", "ws4"].every((id, i) => byEp[i + 1]?.event_id === id), "Games 1-4 link to their games by both teams' names", JSON.stringify(links.map((l) => [l.episode, l.event_id])));
    check(byEp[5]?.event_id === "ws5", '"Game 5" (no names) takes that day\'s game between the series\' teams');
    check(!byEp[6] && !byEp[7] && r.unmatched.join() === "6", "Game 6 isn't scheduled yet (unmatched); Game 7, three weeks out, isn't due", JSON.stringify(r.unmatched));
    check(byEp[1]?.name === "ZT Rays at ZT Brewers" && byEp[1].starts_at.toISOString() === stamp(1) && byEp[1].part === null, "  each link keeps the game's name and start");
    check(JSON.stringify(byEp[1]?.teams.map((t) => t.id).sort()) === JSON.stringify(["30", "8"]), "  and its teams, for the cast", JSON.stringify(byEp[1]?.teams));
    const sbAsked = sb.asked.filter((x) => x.includes("/scoreboard"));
    check(sbAsked.every((x) => x.includes("/zt-mlb/")), "only baseball's scoreboards were asked (its search votes settled it)", sbAsked.join(" "));
    let state = await stateOf(seasonId);
    check(state.linked === 5 && /episode 6/.test(state.message) && Math.abs(hoursTo(state.next_at, now) - 20) < 0.1, "sports_links: 5 linked, Game 6 said, looked at again the next day", JSON.stringify(state));

    const asked = sb.asked.length;
    r = await linkSeason(seasonId, at());
    check(r.added === 0 && sb.asked.length === asked, "a run with nothing new asks the stand-in nothing", sb.asked.slice(asked).join(" "));

    sb.events.push(game("ws6", 6, "8", "30", "pre"));
    r = await linkSeason(seasonId, at(2 * HOUR));
    check(r.added === 1 && (await linksOf(seasonId)).find((l) => l.episode === 6)?.event_id === "ws6", "Game 6 links once it's scheduled (the day's games kept an hour)");
    state = await stateOf(seasonId);
    check(state.message === null && hoursTo(state.next_at, now + 2 * HOUR) > 24, "  nothing missing: looked at again when Game 7 comes within the week", JSON.stringify(state));

    // A listing correction moves Game 2 two days on, onto Game 3's day: Game 3's game stays Game 3's.
    await pool.query("UPDATE season_episodes SET air_at = air_at + interval '2 days' WHERE season_id = $1 AND number = 2", [seasonId]);
    r = await linkSeason(seasonId, at(2 * HOUR));
    links = await linksOf(seasonId);
    check(!links.find((l) => l.episode === 2) && links.find((l) => l.episode === 3)?.event_id === "ws3" && r.unmatched.join() === "2", "Game 2 moved onto Game 3's day: its link goes, Game 3's game isn't taken", JSON.stringify(links.map((l) => [l.episode, l.event_id])));
    check(new Set(links.map((l) => l.event_id)).size === links.length, "  no game linked twice");
    await pool.query("UPDATE season_episodes SET air_at = air_at - interval '2 days' WHERE season_id = $1 AND number = 2", [seasonId]);
    r = await linkSeason(seasonId, at(2 * HOUR));
    check((await linksOf(seasonId)).find((l) => l.episode === 2)?.event_id === "ws2", "  moved back, it links to its own game again");

    // The stand-in down (and nothing cached for this run's days): what's linked stays, and it's looked at again an hour on.
    await pool.query("DELETE FROM season_events WHERE season_id = $1 AND episode = 3", [seasonId]);
    sb.down = true;
    const fresh = (ms) => ({ providers: [withCache(espn(sb.url), { prefix: "zt-sports-b:", now: () => now + ms })], now: new Date(now + ms) });
    r = await linkSeason(seasonId, fresh(3 * HOUR));
    state = await stateOf(seasonId);
    check(/503/.test(r.message) && state.linked === 5 && Math.abs(hoursTo(state.next_at, now + 3 * HOUR) - 1) < 0.1, "the stand-in down: links kept, said so, looked at again an hour on", JSON.stringify(state));
    sb.down = false;
    // The daily job's part: this season only (never a real one), due again two hours on; it fills in the season's people too.
    let job = await linkSportSeasons({ ...fresh(5 * HOUR), only: [seasonId] });
    check(job.seasons === 1 && job.linked === 1 && (await linksOf(seasonId)).find((l) => l.episode === 3)?.event_id === "ws3", "the daily job's part relinks it once it's due", JSON.stringify(job));

    console.log("\n== its people (step 3)");
    const rows = await castOf(seasonId);
    check(job.people === 7 && rows.length === 7, "the daily job filled in both teams' players from their rosters", JSON.stringify(job));
    check(!rows.some((x) => /Manager/.test(x.name)), "  players only: never the manager (ESPN's coach is apart)");
    check(rows.map((x) => x.tribe_name).join() === "ZT Brewers,ZT Brewers,ZT Brewers,ZT Rays,ZT Rays,ZT Rays,ZT Rays", "  team by team, in the order they first play", rows.map((x) => x.tribe_name).join());
    const ace = rows.find((x) => x.name === "ZT Sam Ace");
    check(ace?.role === "Starting Pitcher" && ace.photo_url === stored("r2") && ace.provider_ids?.espn === "r2", "  each with position, ESPN's headshot and ESPN's id (for stats)", JSON.stringify(ace));
    check(rows.find((x) => x.name === "ZT Pat Utility")?.photo_url === null, "  no headshot: Wikipedia looked (it has none for a ZT name), so initials");
    job = await linkSportSeasons({ ...fresh(5 * HOUR), only: [seasonId] });
    check(job.seasons === 0, "  and with nothing left due, the daily job doesn't look at it", JSON.stringify(job));
    const again = await castFromEvents(seasonId, at(6 * HOUR));
    check(again.filled === 0 && (await castOf(seasonId)).length === 7, "run again: nobody twice", JSON.stringify(again));

    const userId = await makeUser(false);
    const me = { id: userId, name: USER };
    let roster = await rosterOf(me, seasonId, undefined, null);
    check(JSON.stringify(sizes(roster)) === JSON.stringify({ "ZT Brewers": 3, "ZT Rays": 4 }) && roster.source === "ESPN", "the Players tab: both teams, credited to ESPN", JSON.stringify(sizes(roster)));
    check(!roster.canFill && !roster.asking && !roster.waiting.length && !roster.unlisted, "  no Fill in who's playing, nothing waiting", JSON.stringify({ canFill: roster.canFill, asking: roster.asking, waiting: roster.waiting }));

    // A game's cast is Make it a game's: never touched.
    await pool.query("UPDATE shows SET set_up_at = now() WHERE id = $1", [showId]);
    await pool.query("DELETE FROM season_cast WHERE season_id = $1 AND name = 'ZT Jo Closer'", [seasonId]);
    const game1 = await castFromEvents(seasonId, at(6 * HOUR));
    check(/game/.test(game1.skipped ?? "") && (await castOf(seasonId)).length === 6, "a game's cast: left alone", JSON.stringify(game1));
    await pool.query("UPDATE shows SET set_up_at = NULL WHERE id = $1", [showId]);

    console.log("\n== a footy season: no rosters, so its players from the box scores");
    const r1At = new Date(now - 2 * DAY).toISOString();
    const r2At = new Date(now + 2 * DAY).toISOString();
    const footyId = await plainSeason(await sportShow("zt-sports-footy", "ZT Footy"), [{ at: r1At, title: "Round 1: ZT Lions at ZT Dockers" }, { at: r2At, title: "Round 2: ZT Swans at ZT Dockers" }]);
    const line = (id, name, position, d) => ({ id, name, position, stats: [String(d), "1", "0"] });
    const labels = ["D", "G", "B"];
    sb.events.push(
      { league: AFL, id: "r1", at: r1At, home: "501", away: "502", state: "post", score: [80, 70], box: { 501: { labels, rows: [line("d1", "ZT Dee Ruck", "R", 21), line("d2", "ZT Dee Wing", "W", 18), line("d3", "ZT Dee Back", "B", 12)] }, 502: { labels, rows: [line("l1", "ZT Lee Mid", "C", 25), line("l2", "ZT Lee Fwd", "F", 9), line("l3", "ZT Lee Key", "FF", 7)] } } },
      { league: AFL, id: "r2", at: r2At, home: "501", away: "503", state: "pre" }
    );
    // The Players tab's own read (nobody's linked it yet): links it, then fills in its people, and answers with them.
    roster = await rosterOf(me, footyId, undefined, sb.url);
    check((await stateOf(footyId))?.league === AFL && (await linksOf(footyId)).length === 2, "the Players tab's read linked it first (both rounds)");
    check(!roster.groups.length && roster.held?.people === 6 && roster.held.episode === 1, "  who played Round 1 is held back until you've seen it", JSON.stringify({ sizes: sizes(roster), held: roster.held }));
    check((await castOf(footyId)).every((x) => x.provider_ids?.espn), "  (they're in: Round 1's box score brought them)");
    await markAt(userId, footyId, 1);
    roster = await rosterOf(me, footyId, undefined, null);
    check(JSON.stringify(sizes(roster)) === JSON.stringify({ "ZT Dockers": 3, "ZT Lions": 3 }) && roster.source === "ESPN" && !roster.held, "  seen Round 1: its players, from its box score", JSON.stringify(sizes(roster)));
    check(roster.waiting.join() === "ZT Swans" && !roster.canFill, "  the Swans haven't played: they wait for their first game (no bot)", JSON.stringify({ waiting: roster.waiting, canFill: roster.canFill }));
    const r2 = sb.events.find((e) => e.id === "r2");
    Object.assign(r2, { state: "post", score: [60, 90], box: { 501: { labels, rows: [line("d1", "ZT Dee Ruck", "R", 20), line("d4", "ZT Dee Sub", "INT", 4)] }, 503: { labels, rows: [line("s1", "ZT Sid Mid", "C", 30), line("s2", "ZT Sid Wing", "W", 14), line("s3", "ZT Sid Key", "FB", 6)] } } });
    const more = await castFromEvents(footyId, { providers: sportsProviders({ base: sb.url }), now: new Date(now + 3 * DAY) });
    check(more.filled === 4 && !more.waiting.length, "Round 2 played: the Swans' players and a new Docker come in, nobody twice", JSON.stringify(more));
    roster = await rosterOf(me, footyId, undefined, null);
    check(JSON.stringify(sizes(roster)) === JSON.stringify({ "ZT Dockers": 3, "ZT Lions": 3 }) && roster.held?.people === 4 && roster.held.episode === 2 && !roster.waiting.length, "  at Round 1, Round 2's new players wait for you to see it (not 'waiting to play')", JSON.stringify({ sizes: sizes(roster), held: roster.held }));
    await markAt(userId, footyId, 2);
    roster = await rosterOf(me, footyId, undefined, null);
    check(JSON.stringify(sizes(roster)) === JSON.stringify({ "ZT Dockers": 4, "ZT Lions": 3, "ZT Swans": 3 }) && !roster.waiting.length && !roster.held, "  seen Round 2: all three teams, nobody waiting", JSON.stringify(sizes(roster)));

    console.log("\n== a race: its field");
    const raceAt = new Date(now - DAY).toISOString();
    const raceId = await plainSeason(await sportShow("zt-sports-race", "ZT Racing"), [{ at: raceAt, title: "ZT Desert Grand Prix" }]);
    sb.events.push({ league: "racing/zt-f1", id: "gp1", at: raceAt, name: "ZT Cruises Desert Grand Prix", state: "post", field: [{ id: "x1", name: "ZT Vel Fast", headshot: shot("x1") }, { id: "x2", name: "ZT Ana Apex", headshot: shot("x2") }, { id: "x3", name: "ZT Bo Pit", headshot: shot("x3") }] });
    const race = await followSeason(raceId, { providers: sportsProviders({ base: sb.url }) });
    const field = await castOf(raceId);
    check(race.link.league === "racing/zt-f1" && race.cast?.filled === 3, "linked by its name (the show's name found the league), its field filled in", JSON.stringify({ link: race.link, cast: race.cast }));
    check(field.every((x) => x.tribe_name === FIELD && x.provider_ids?.espn && x.photo_url), "  one group, the field, each with ESPN's id and headshot");
    check(field.map((x) => x.name).join() === "ZT Ana Apex,ZT Bo Pit,ZT Vel Fast", "  by name, not the order it finished in (that's a spoiler)", field.map((x) => x.name).join());

    console.log("\n== Fill in who's playing: the sports data first");
    const seriesB = await plainSeason(await sportShow("zt-sports-b", "ZT Series B"), [{ at: new Date(Date.parse(stamp(1)) - 3 * HOUR).toISOString(), title: "Game 1: ZT Cubs at ZT Mets" }]);
    await pool.query("INSERT INTO show_follows (user_id, season_id) VALUES ($1, $2)", [userId, seriesB]);
    const filled = await askRoster(me, seriesB, undefined, sb.url);
    check(JSON.stringify(sizes(filled)) === JSON.stringify({ "ZT Mets": 2, "ZT Cubs": 2 }) && filled.source === "ESPN" && !filled.asking, "a series nobody linked: linked and filled at once, no bot", JSON.stringify({ sizes: sizes(filled), asking: filled.asking }));
    const via = (await pool.query("SELECT via, asking_at FROM cast_fills WHERE season_id = $1", [seriesB])).rows[0];
    check(via?.via === "sports" && !via.asking_at, "  the fill says it came from the sports data, and is let go", JSON.stringify(via));

    console.log("\n== a show that isn't a sport, one filled in another way, and a sport nobody has");
    const compId = await plainSeason(await sportShow("zt-sports-comp", "ZT Bake Off", "competition"), [{ days: -2, title: "Bread Week" }]);
    r = await linkSeason(compId, at());
    check(r.message === "Not a sport" && !(await stateOf(compId)) && !(await linksOf(compId)).length, "a competition: left alone (nothing written)");
    const curlId = await plainSeason(await sportShow("zt-sports-curl", "ZT Curling Hour"), [{ days: -7, title: "Episode 1" }, { days: -1, title: "Episode 2" }]);
    r = await linkSeason(curlId, at());
    state = await stateOf(curlId);
    check(r.league === null && /No ESPN games fit/.test(state.message) && Math.abs(hoursTo(state.next_at, now) - 7 * 24) < 0.1, "a sport no provider has: says so, looks again a week on", JSON.stringify(state));
    roster = await rosterOf(me, curlId, undefined, null);
    check(roster.canFill && roster.unlisted && roster.sportsName === "ESPN", "  the Players tab offers Fill in who's playing, saying ESPN hasn't got it", JSON.stringify({ canFill: roster.canFill, unlisted: roster.unlisted }));
    // People our bot filled in, and a game linked later: theirs stay as they are.
    await pool.query("INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1, 'ZT Curler', 'ZT Rinks', 0)", [curlId]);
    await pool.query(`INSERT INTO season_events (season_id, episode, provider, league, event_id, teams) VALUES ($1, 1, 'espn', 'baseball/zt-mlb', 'ws1', '[{"id":"30","name":"ZT Rays"},{"id":"8","name":"ZT Brewers"}]')`, [curlId]);
    const theirs = await castFromEvents(curlId, at());
    check(/another way/.test(theirs.skipped ?? "") && (await castOf(curlId)).length === 1, "people filled in another way: left alone", JSON.stringify(theirs));

    console.log("\n== their stats (step 4): box scores, coming in, through the guard");
    // ZT Jo Closer back (the game's-cast check above took him out).
    await castFromEvents(seasonId, at(6 * HOUR));
    check((await castOf(seasonId)).length === 7, "the series' seven players", String((await castOf(seasonId)).length));
    check((await statsDue(seasonId)).due, "stats are due: three games over, nobody's coming in yet");
    let mark = sb.asked.length;
    let fill = await statsFromEvents(seasonId, at(6 * HOUR));
    const asks = sb.asked.slice(mark);
    check(fill.games === 3 && fill.comingIn === 7 && !fill.message, "Games 1-3 read (Game 4 isn't over), and everyone's coming in", JSON.stringify(fill));
    check(asks.filter((x) => x.includes("/summary")).length === 3 && asks.filter((x) => x.includes("/athletes/")).length === 7 && asks.length === 10, "  3 box scores and 7 season lines asked, nothing else (the day's games were cached)", asks.join(" "));
    check(asks.filter((x) => x.includes("/athletes/")).every((x) => /season=2026/.test(x)), "  the 2026 season: these games are its postseason, so its regular season is coming in");
    const ends = (await linksOf(seasonId)).map((l) => `${l.episode}:${l.lines_final}`).join();
    check(ends.startsWith("1:true,2:true,3:true,4:false"), "  Games 1-3's lines final, Game 4's not read", ends);
    const k1 = (await pool.query("SELECT tables FROM game_lines WHERE season_id = $1 AND episode = 1 AND athlete = 'r2'", [seasonId])).rows[0];
    check(k1?.tables.map((t) => t.name).join() === "pitching" && k1.tables[0].labels.join() === PITCH.join(), "  a line in ESPN's own table and columns (the pitcher's pitching)", JSON.stringify(k1));
    const r4in = (await pool.query("SELECT label, tables FROM game_lines WHERE season_id = $1 AND episode = 0 AND athlete = 'r4'", [seasonId])).rows[0];
    check(r4in?.label === "2026 regular season" && r4in.tables.length === 1 && r4in.tables[0].values[8] === ".286", "  coming in: the 2026 regular season, its postseason left out", JSON.stringify(r4in));
    const none = (await pool.query("SELECT tables FROM game_lines WHERE season_id = $1 AND episode = 0 AND athlete = 'r1'", [seasonId])).rows[0];
    check(Array.isArray(none?.tables) && !none.tables.length, "  someone with no season line: kept as asked (nothing), not asked again");
    mark = sb.asked.length;
    fill = await statsFromEvents(seasonId, at(6 * HOUR));
    check(fill.games === 0 && fill.comingIn === 0 && sb.asked.length === mark && !(await statsDue(seasonId)).due, "run again: nothing's due and nothing's asked", sb.asked.slice(mark).join(" "));

    const view = async (n) => {
      await markAt(userId, seasonId, n);
      return rosterOf(me, seasonId, undefined, null);
    };
    let tab = await view(0);
    check(tab.stats.through === null && tab.stats.newer === 3 && tab.stats.comingInLabel === "2026 regular season", "at Game 0: no so far, Game 3's waiting, coming in is the 2026 regular season", JSON.stringify(tab.stats));
    check(!tab.groups.some((g) => g.people.some((p) => p.stats?.soFar)), "  nobody has a so far");
    check(statLine(tab, "ZT Kim Slugger", "comingIn") === "560 AB · 88 R · 160 H · 35 HR · 101 RBI · 70 BB · .286 AVG · .370 OBP · .540 SLG", "  a hitter's coming in, in the columns the games show", statLine(tab, "ZT Kim Slugger", "comingIn"));
    check(statLine(tab, "ZT Sam Ace", "comingIn") === "3.40 ERA · 180.2 IP · 200 K · 45 BB · 150 H · 72 R · 68 ER", "  a pitcher's", statLine(tab, "ZT Sam Ace", "comingIn"));
    check(statLine(tab, "ZT Pat Utility", "comingIn") === null, "  no season line: no coming in");
    tab = await view(1);
    check(tab.stats.through === 1 && tab.stats.newer === 3, "at Game 1: through Game 1, Game 3's waiting", JSON.stringify(tab.stats));
    check(statLine(tab, "ZT Kim Slugger", "soFar") === "2-4 H-AB · 1 R · 2 RBI · 1 HR · 18 #P", "  a hitter's Game 1 (H and AB in H-AB; zeros and AVG left out)", statLine(tab, "ZT Kim Slugger", "soFar"));
    check(statLine(tab, "ZT Max Outfield", "soFar") === null, "  someone who first played in Game 2: nothing yet (Game 2 isn't sent)");
    tab = await view(3);
    check(tab.stats.through === 3 && tab.stats.newer === null, "at Game 3: through Game 3, nothing newer", JSON.stringify(tab.stats));
    check(statLine(tab, "ZT Kim Slugger", "soFar") === "3-11 H-AB · 2 R · 2 RBI · 1 HR · 1 BB · 3 K · 50 #P", "  the hitter's three games added up", statLine(tab, "ZT Kim Slugger", "soFar"));
    check(statLine(tab, "ZT Jo Closer", "soFar") === "1 H · 1 R · 1 ER · 1 BB · 2 K · 32-21 PC-ST", "  a reliever's two (IP is thirds: never summed; PC in PC-ST)", statLine(tab, "ZT Jo Closer", "soFar"));
    check(/ESPN/.test(tab.source) && !tab.stats.asking && !tab.stats.message, "  nothing going, nothing wrong");

    // A live Game 4, four hours after it started: read, not again for ten minutes, then final.
    const ws4 = sb.events.find((e) => e.id === "ws4");
    Object.assign(ws4, { state: "in", box: box({ 30: [[["r4", "ZT Kim Slugger", b("1-2", 1, 1, 1, 0, 0, 9)]], []], 8: [[], []] }) });
    const after4 = Date.parse(stamp(4)) + 4 * HOUR - now;
    fill = await statsFromEvents(seasonId, at(after4));
    let l4 = (await linksOf(seasonId)).find((l) => l.episode === 4);
    check(fill.games === 1 && l4.lines_final === false && l4.lines_at, "a live Game 4: read, not final", JSON.stringify(fill));
    mark = sb.asked.length;
    fill = await statsFromEvents(seasonId, at(after4 + 5 * 60_000));
    check(fill.games === 0 && sb.asked.length === mark, "  five minutes on: not read again");
    Object.assign(ws4, { state: "post", score: [4, 2], box: box({ 30: [[["r4", "ZT Kim Slugger", b("2-4", 2, 3, 2, 0, 1, 19)]], []], 8: [[["b3", "ZT Max Outfield", b("0-4", 0, 0, 0, 0, 2, 14)]], []] }) });
    fill = await statsFromEvents(seasonId, at(after4 + 15 * 60_000));
    l4 = (await linksOf(seasonId)).find((l) => l.episode === 4);
    check(fill.games === 1 && l4.lines_final === true, "  over: read again, final", JSON.stringify(fill));
    tab = await view(3);
    check(tab.stats.through === 3 && tab.stats.newer === 4 && statLine(tab, "ZT Kim Slugger", "soFar").startsWith("3-11 H-AB"), "  at Game 3 it's said to be waiting, and not added", JSON.stringify(tab.stats));
    tab = await view(4);
    check(tab.stats.through === 4 && statLine(tab, "ZT Kim Slugger", "soFar") === "5-15 H-AB · 4 R · 5 RBI · 3 HR · 1 BB · 4 K · 69 #P", "  at Game 4: four games", statLine(tab, "ZT Kim Slugger", "soFar"));

    // A listing that moves Game 2 off its game: its lines go with its link; moved back, they come back.
    await pool.query("UPDATE season_episodes SET air_at = air_at + interval '2 days' WHERE season_id = $1 AND number = 2", [seasonId]);
    await linkSeason(seasonId, at(2 * HOUR));
    await statsFromEvents(seasonId, at(6 * HOUR));
    const gone = (await pool.query("SELECT count(*)::int AS n FROM game_lines WHERE season_id = $1 AND episode = 2", [seasonId])).rows[0].n;
    tab = await view(2);
    check(gone === 0 && tab.stats.through === 1, "Game 2 moved off its game: its lines go (at Game 2, so far is Game 1's)", JSON.stringify({ gone, through: tab.stats.through }));
    await pool.query("UPDATE season_episodes SET air_at = air_at - interval '2 days' WHERE season_id = $1 AND number = 2", [seasonId]);
    await linkSeason(seasonId, at(2 * HOUR));
    await statsFromEvents(seasonId, at(6 * HOUR));
    tab = await view(2);
    check(tab.stats.through === 2 && statLine(tab, "ZT Max Outfield", "soFar")?.startsWith("2-4 H-AB"), "  moved back: linked again, its lines back", JSON.stringify(tab.stats));

    // The Players tab's own read fills what's due (here: Game 3, read again), after the answer (in a script, at once).
    await pool.query("DELETE FROM game_lines WHERE season_id = $1 AND episode = 3", [seasonId]);
    await pool.query("UPDATE season_events SET lines_final = false, lines_at = NULL WHERE season_id = $1 AND episode = 3", [seasonId]);
    await markAt(userId, seasonId, 3);
    tab = await rosterOf(me, seasonId, undefined, sb.url);
    check(tab.stats.through === 3 && statLine(tab, "ZT Kim Slugger", "soFar")?.startsWith("3-11 H-AB") && !tab.stats.asking, "the Players tab's read filled Game 3 back in", JSON.stringify(tab.stats));

    // A footy season's rounds, added up; a race's places.
    fill = await statsFromEvents(footyId, { providers: sportsProviders({ base: sb.url }), now: new Date(now + 3 * DAY) });
    await markAt(userId, footyId, 1);
    tab = await rosterOf(me, footyId, undefined, null);
    check(fill.games === 2 && statLine(tab, "ZT Dee Ruck", "soFar") === "21 D · 1 G", "footy at Round 1: its own columns (D, G; B's 0 left out)", JSON.stringify({ fill, line: statLine(tab, "ZT Dee Ruck", "soFar") }));
    await markAt(userId, footyId, 2);
    tab = await rosterOf(me, footyId, undefined, null);
    check(statLine(tab, "ZT Dee Ruck", "soFar") === "41 D · 2 G" && statLine(tab, "ZT Sid Mid", "soFar") === "30 D · 1 G", "  at Round 2: both rounds added up", statLine(tab, "ZT Dee Ruck", "soFar"));
    check(tab.stats.comingInLabel === null && !tab.groups.some((g) => g.people.some((p) => p.stats?.comingIn)), "  no season lines on the stand-in: no coming in");
    fill = await statsFromEvents(raceId, { providers: sportsProviders({ base: sb.url }) });
    await markAt(userId, raceId, 0);
    tab = await rosterOf(me, raceId, undefined, null);
    check(fill.games === 1 && !tab.groups.some((g) => g.people.some((p) => p.stats?.soFar)), "a race not seen: no places", JSON.stringify(fill));
    await markAt(userId, raceId, 1);
    tab = await rosterOf(me, raceId, undefined, null);
    check(statLine(tab, "ZT Vel Fast", "soFar") === "1st" && statLine(tab, "ZT Bo Pit", "soFar") === "3rd" && tab.stats.through === 1, "  seen: each one's place, from the scoreboard (no box score)", statLine(tab, "ZT Vel Fast", "soFar"));
  } finally {
    await tv.close();
    await sb.close();
  }
}

async function realSeries() {
  console.log("\n== the real 2026 World Series (TVmaze 20637, ESPN)");
  const listing = await showListing(20637, "https://api.tvmaze.com");
  const season = listing?.seasons.find((s) => s.number === 2026);
  if (!season) return check(false, "TVmaze has the World Series' 2026 season");
  const showId = await sportShow("zt-sports-real", "World Series");
  const seasonId = await listedSeason(showId, listing.show, season, "https://api.tvmaze.com", new Date(), null);
  const calls = [];
  const raw = espn();
  const countedEspn = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "function" ? (...a) => (calls.push(`${k}(${a.join(", ")})`), v(...a)) : v]));
  const providers = [withCache(countedEspn, { prefix: "zt-sports:" })];
  const t0 = Date.now();
  const r = await linkSeason(seasonId, { providers });
  console.log(`  ${calls.length} ESPN calls in ${Date.now() - t0} ms: ${calls.join(", ")}`);
  const { rows: eps } = await pool.query("SELECT number, title, air_at FROM season_episodes WHERE season_id = $1 ORDER BY number", [seasonId]);
  const links = await linksOf(seasonId);
  for (const e of eps) {
    const l = links.find((x) => x.episode === e.number);
    console.log(`  ${e.number}  ${e.title}  ${e.air_at?.toISOString() ?? "-"}  ->  ${l ? `${l.event_id} ${l.name} ${l.starts_at?.toISOString()}` : "not linked"}`);
  }
  check(r.league === "baseball/mlb", "its league: baseball/mlb, from ESPN's search for the teams the titles name", JSON.stringify(r));
  check(links.find((l) => l.episode === 1)?.event_id === "401908042", "Game 1 is ESPN's 401908042");
  const aired = eps.filter((e) => e.air_at && e.air_at.getTime() < Date.now() - 4 * HOUR);
  check(aired.length >= 3 && aired.every((e) => links.some((l) => l.episode === e.number)), `every game that's aired is linked (${aired.length})`);
  const { matchupOf, wordsOf } = jiti("../../src/lib/game/sports-match.ts");
  check(
    links.every((l) => {
      const e = eps.find((x) => x.number === l.episode);
      const [a, b] = matchupOf(e.title);
      return wordsOf(l.name).join(" ") === wordsOf(`${a} at ${b}`).join(" ") && Math.abs(l.starts_at - e.air_at) <= 2 * HOUR;
    }),
    "each to the game its title names, starting when it airs"
  );
  let before = calls.length;
  await pool.query("DELETE FROM season_events WHERE season_id = $1", [seasonId]);
  await linkSeason(seasonId, { providers });
  check(calls.length === before && (await linksOf(seasonId)).length === links.length, "linked again from scratch: ESPN isn't asked (the cache)", calls.slice(before).join(", "));

  before = calls.length;
  const t1 = Date.now();
  const fill = await castFromEvents(seasonId, { providers });
  const cast = await castOf(seasonId);
  console.log(`  its people: ${fill.filled} in ${Date.now() - t1} ms over ${calls.length - before} ESPN calls (${calls.slice(before).join(", ")})`);
  await realCast(cast);

  console.log("\n== its stats (step 4): the games' box scores and the 2026 regular season");
  before = calls.length;
  const t2 = Date.now();
  const st = await statsFromEvents(seasonId, { providers });
  const asked = calls.slice(before);
  console.log(`  ${st.games} games, ${st.comingIn} coming in, in ${Date.now() - t2} ms over ${asked.length} ESPN calls (${asked.filter((x) => x.startsWith("boxScore")).length} box scores, ${asked.filter((x) => x.startsWith("seasonStats")).length} season lines)`);
  const over = links.filter((l) => l.starts_at && l.starts_at.getTime() < Date.now() - 3 * HOUR);
  check(!st.message && st.games === over.length && over.length >= 3, `every game that's over read (${over.length})`, JSON.stringify(st));
  check(st.comingIn === cast.length && asked.filter((x) => x.startsWith("seasonStats")).every((x) => x.endsWith(", 2026)")), "  everyone's 2026 regular season asked once (the games are its postseason)");
  const finals = (await linksOf(seasonId)).filter((l) => l.lines_final).map((l) => l.episode);
  check([1, 2, 3].every((n) => finals.includes(n)), "  Games 1-3's lines final", finals.join());
  const userId = await makeUser(false);
  const me = { id: userId, name: USER };
  const view = async (n) => {
    await markAt(userId, seasonId, n);
    return rosterOf(me, seasonId, undefined, null);
  };
  let tab = await view(0);
  console.log(`  at Game 0, Yandy Diaz coming in (${tab.stats.comingInLabel}): ${statLine(tab, "Yandy Diaz", "comingIn")}`);
  check(tab.stats.through === null && tab.stats.comingInLabel === "2026 regular season" && !tab.groups.some((g) => g.people.some((p) => p.stats?.soFar)), "at Game 0: coming in only, the 2026 regular season");
  check(/\.293 AVG/.test(statLine(tab, "Yandy Diaz", "comingIn") ?? "") && /22 HR/.test(statLine(tab, "Yandy Diaz", "comingIn") ?? ""), "  Yandy Díaz's .293 and 22 HR (his regular season, not his .269 postseason)");
  tab = await view(1);
  console.log(`  at Game 1: Yandy Diaz ${statLine(tab, "Yandy Diaz", "soFar")}; Nick Martinez ${statLine(tab, "Nick Martinez", "soFar")}`);
  check(statLine(tab, "Yandy Diaz", "soFar") === "0-4 H-AB · 13 #P" && tab.stats.through === 1, "  Yandy Díaz in Game 1: 0-4 (ESPN's box score)");
  check(statLine(tab, "Nick Martinez", "soFar") === "5 H · 2 R · 2 ER · 5 K · 73-52 PC-ST", "  Nick Martinez's Game 1 start (IP and ERA left to the season line)");
  tab = await view(3);
  console.log(`  at Game 3: Yandy Diaz ${statLine(tab, "Yandy Diaz", "soFar")}`);
  check(statLine(tab, "Yandy Diaz", "soFar") === "2-13 H-AB · 1 R · 1 RBI · 3 K · 57 #P" && tab.stats.through === 3, "  through Game 3: 2-13, Games 1-3 added up");
  const people = tab.groups.flatMap((g) => g.people);
  console.log(`  ${people.filter((p) => p.stats?.soFar).length} with a so far, ${people.filter((p) => p.stats?.comingIn).length} with coming in, of ${people.length}`);
  check(people.filter((p) => p.stats?.soFar).length >= 30 && people.filter((p) => p.stats?.comingIn).length >= people.length * 0.8, "  most have both lines");
  before = calls.length;
  await statsFromEvents(seasonId, { providers });
  check(calls.length === before, "run again: ESPN isn't asked", calls.slice(before).join(", "));
}

/** The real World Series' people: both teams' players, ESPN's headshots and ids, never a manager. */
async function realCast(cast) {
  const by = (team) => cast.filter((x) => x.tribe_name === team);
  console.log(`  ${by("Milwaukee Brewers").length} Brewers, ${by("Tampa Bay Rays").length} Rays; ${cast.filter((x) => x.photo_url?.startsWith("https://a.espncdn.com/")).length} ESPN headshots`);
  check(by("Milwaukee Brewers").length >= 20 && by("Tampa Bay Rays").length >= 20 && cast.length === by("Milwaukee Brewers").length + by("Tampa Bay Rays").length, "both teams' players, nobody else");
  check(!cast.some((x) => /Kevin Cash|Pat Murphy/.test(x.name)), "  never a manager (Kevin Cash, Pat Murphy)");
  check(cast.filter((x) => x.photo_url?.startsWith("https://a.espncdn.com/combiner/")).length >= cast.length * 0.8, "  most with ESPN's headshot, at a face's size (its resizer)");
  check(cast.every((x) => x.provider_ids?.espn && x.role), "  each with ESPN's id and position");
  check(cast.some((x) => x.name === "Yandy Diaz" && x.provider_ids.espn === "33481"), "  Yandy Díaz is ESPN's 33481");
}

async function viaServer() {
  console.log("\n== the real World Series, added through the dev server");
  const here = await pool.query("SELECT id FROM shows WHERE tvmaze_id = $1", [WORLD_SERIES]);
  if (here.rows.length) return console.log("  skipped: this database already has the World Series (a real show is never touched)");
  const userId = await makeUser(true);
  await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [userId]);
  serverStart = new Date();
  const { api, open, BASE } = require("./browser");
  const me = await api({ user: USER, pass: PASSWORD });
  const added = await me.call("POST", "/api/me/shows", { listing: WORLD_SERIES });
  check(added.status === 200 && added.body.seasonId, "zt_sports adds the World Series from the TV listings", JSON.stringify(added.body));
  if (!added.body.seasonId) return;
  const seasonId = added.body.seasonId;
  // Linked, then its people filled in, after the answer.
  let roster = null;
  for (let i = 0; i < 45 && !(roster?.groups.length >= 2); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if ((await castOf(seasonId)).length) roster = (await me.call("GET", `/api/seasons/${seasonId}/roster`)).body;
  }
  const links = await linksOf(seasonId);
  const state = await stateOf(seasonId);
  console.log(`  ${links.length} games linked after the answer: ${links.map((l) => `${l.episode} ${l.event_id}`).join(", ")}; ${JSON.stringify(state && { league: state.league, linked: state.linked, message: state.message })}`);
  check(links.length >= 3 && links.find((l) => l.episode === 1)?.event_id === "401908042" && state?.league === "baseball/mlb", "its season linked after the answer, Game 1 to ESPN's 401908042");
  check(roster?.source === "ESPN" && !roster.canFill && roster.groups.map((g) => g.name).sort().join() === "Milwaukee Brewers,Tampa Bay Rays", "the Players tab's read: both teams, credited to ESPN", JSON.stringify(roster && { source: roster.source, groups: sizes(roster) }));
  await realCast(await castOf(seasonId));

  // The page itself, at --width.
  fs.mkdirSync(shots, { recursive: true });
  const b = await open({ user: USER, pass: PASSWORD, width });
  const errors = [];
  b.page.on("pageerror", (e) => errors.push(e.message));
  try {
    await b.page.goto(`${BASE}/show/${seasonId}/cast`, { waitUntil: "load" });
    await b.page.locator("[data-roster-group]").first().waitFor({ timeout: 60000 });
    await b.page.evaluate(() => document.fonts.ready);
    check((await b.page.locator("[data-roster-group]").count()) === 2, "the page: both teams");
    check((await b.page.locator("[data-roster-photo]").count()) >= 40, "  their headshots");
    // The first screenful's photos, loaded.
    const loaded = await b.page
      .waitForFunction(() => [...document.querySelectorAll("img[data-roster-photo]")].slice(0, 6).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 })
      .then(() => true, () => false);
    check(loaded, "  the first screenful's headshots load");
    // (Their stats may already be in by now: step 4's credit says so.)
    check(/Players(,| and) headshots( and stats)? from ESPN/.test((await b.page.locator("[data-roster-source]").textContent()) ?? ""), "  and the credit under the roster");
    check(await b.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "  nothing wider than the screen");
    await b.page.screenshot({ path: path.join(shots, `players-${width}.png`) });
    await b.page.locator("[data-roster-source]").scrollIntoViewIfNeeded();
    await b.page.screenshot({ path: path.join(shots, `players-${width}-end.png`) });

    // Their stats (step 4), filled after the tab's reads; zt_sports has seen Game 2.
    await markAt(userId, seasonId, 2);
    let st = null;
    for (let i = 0; i < 60 && !(st?.stats.through === 2 && !st.stats.asking && st.groups.some((g) => g.people.some((p) => p.stats?.comingIn))); i++) {
      st = (await me.call("GET", `/api/seasons/${seasonId}/roster`)).body;
      if (!(st?.stats.through === 2 && !st.stats.asking)) await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`  the tab's stats: ${JSON.stringify(st?.stats)}; Yandy Diaz so far ${statLine(st, "Yandy Diaz", "soFar")}, coming in ${statLine(st, "Yandy Diaz", "comingIn")}`);
    check(st?.stats.through === 2 && st.stats.comingInLabel === "2026 regular season", "their stats through the dev server: through Game 2 (where zt_sports is), the 2026 regular season coming in", JSON.stringify(st?.stats));
    check(statLine(st, "Yandy Diaz", "soFar") === "0-9 H-AB · 1 R · 3 K · 39 #P", "  Yandy Díaz's Games 1 and 2, never Game 3", statLine(st, "Yandy Diaz", "soFar"));
    await b.page.goto(`${BASE}/show/${seasonId}/cast`, { waitUntil: "load" });
    await b.page.locator('[data-roster-stats="so-far"]').first().waitFor({ timeout: 60000 });
    await b.page.evaluate(() => document.fonts.ready);
    const bar = (await b.page.locator("[data-roster-statsbar]").textContent()) ?? "";
    check(/Stats through Game 2/.test(bar) && /Coming in: 2026 regular season/.test(bar) && /Game 3's stats open once you've seen it/.test(bar), "the page: the stats bar says through Game 2, coming in, and Game 3 waiting", bar);
    const yandy = b.page.locator('[data-roster-person="Yandy Diaz"]');
    const text = async (loc) => ((await loc.textContent()) ?? "").replace(/\u00a0/g, " ");
    check(/Thru Game 2 · 0-9 H-AB · 1 R · 3 K · 39 #P/.test(await text(yandy.locator('[data-roster-stats="so-far"]'))), "  Yandy Díaz's so far line");
    check(/2026 regular season · .*\.293 AVG/.test(await text(yandy.locator('[data-roster-stats="coming-in"]'))), "  and his coming in");
    check((await b.page.locator('[data-roster-stats="so-far"]').count()) >= 25 && (await b.page.locator('[data-roster-stats="coming-in"]').count()) >= 40, "  both lines for most of them");
    const tall = await b.page.evaluate(() => Math.max(...[...document.querySelectorAll("[data-roster-stats]")].map((e) => Math.round(e.getBoundingClientRect().height))));
    check(tall <= 40, `  a line wraps to two at most (${tall} px)`);
    check(/Players, headshots and stats from ESPN/.test((await b.page.locator("[data-roster-source]").textContent()) ?? ""), "  the credit says stats too");
    check(await b.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "  nothing wider than the screen");
    await yandy.scrollIntoViewIfNeeded();
    await b.page.screenshot({ path: path.join(shots, `players-stats-${width}.png`) });
    await b.page.goto(`${BASE}/settings`, { waitUntil: "load" });
    await b.page.locator("[data-settings-help]").waitFor({ timeout: 60000 });
    await b.page.locator("[data-settings-help]").getByText("Credits", { exact: true }).click();
    await b.page.locator('[data-credit="espn"]').waitFor({ timeout: 10000 });
    check(/ESPN/.test((await b.page.locator('[data-credit="espn"]').textContent()) ?? "") && /isn.t connected with ESPN/.test((await b.page.locator('[data-credit="espn"]').textContent()) ?? ""), "Settings › Credits credits ESPN");
    await b.page.screenshot({ path: path.join(shots, `credits-${width}.png`) });
    check(!errors.length, "no page errors", errors.join(" | "));
    console.log(`  screenshots in ${shots}`);
  } finally {
    await b.close();
  }

  console.log("\n== a sport ESPN hasn't got, on stand-ins through the dev server: the sports data, then the bot");
  const fakeBot = require("./fake-bot");
  const tv = await fakeListings.start();
  const sb = await fakeEspn.start();
  const bot = await fakeBot.start({ answer: () => JSON.stringify({ groups: [{ name: "ZT Field", people: [{ name: "ZT Driver Alpha", role: "Driver" }, { name: "ZT Driver Beta", role: "Driver" }] }] }), delayMs: 500 });
  try {
    const them = await api({ user: USER, pass: PASSWORD, headers: { "x-gys-listings": tv.url, "x-gys-sports": sb.url, "x-gys-bot": bot.url } });
    const gp = await them.call("POST", "/api/me/shows", { listing: 990012 });
    check(gp.status === 200 && gp.body.seasonId, "zt_sports adds the stand-in Grand Prix (a sport)", JSON.stringify(gp.body));
    const sid = gp.body.seasonId;
    let r = (await them.call("GET", `/api/seasons/${sid}/roster`)).body;
    check(r.asking && r.via === "sports", "the Players tab's read looks for it on the sports data first", JSON.stringify({ asking: r.asking, via: r.via }));
    for (let i = 0; i < 20 && r.asking; i++) {
      await new Promise((res) => setTimeout(res, 1000));
      r = (await them.call("GET", `/api/seasons/${sid}/roster`)).body;
    }
    check(!r.asking && r.canFill && r.unlisted && !r.groups.length, "  ESPN hasn't got it: Fill in who's playing, saying so", JSON.stringify({ asking: r.asking, canFill: r.canFill, unlisted: r.unlisted }));
    const searched = sb.asked.filter((x) => x.startsWith("/apis/search")).length;
    r = (await them.call("POST", `/api/seasons/${sid}/roster`, { action: "ask" })).body;
    check(sb.asked.filter((x) => x.startsWith("/apis/search")).length === searched || r.asking, "  the tap asks the sports data again (from the cache), then the bot");
    for (let i = 0; i < 30 && !r.groups?.length; i++) {
      await new Promise((res) => setTimeout(res, 1000));
      r = (await them.call("GET", `/api/seasons/${sid}/roster`)).body;
    }
    check(bot.asked.length === 1 && r.groups?.[0]?.people.length === 2 && r.source === null, "  the bot's answer is its roster (not credited to ESPN)", JSON.stringify({ asked: bot.asked.length, groups: r.groups && sizes(r), source: r.source }));
  } finally {
    await tv.close();
    await sb.close();
    await bot.close();
  }
}

(async () => {
  try {
    console.log(`(first) removed ${await down()}`);
    if (real) await realSeries();
    else if (server) await viaServer();
    else await standIn();
  } finally {
    if (!keep) console.log(`\nremoved ${await down()}`);
    await pool.end();
  }
  console.log(failures ? `\nFAILED (${failures})` : "\nall good");
  if (failures) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
