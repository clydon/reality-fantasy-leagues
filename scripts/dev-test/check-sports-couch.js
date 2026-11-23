// Dev-only check of U1's sports slice, sports on the couch (docs/PLAN-start-a-game-gpt.md U1; src/new/sports/, the routes under
// src/app/api/sports/: search, schedule, follow, couch, week, start, shown), against the dev server, on new-fixture.js's couch
// (alex, riley, jordan, sam) and a stand-in ESPN (fake-espn.js, by the x-gys-sports header): the real ESPN is never asked.
//
// The stand-in has two ZT leagues the app's search reads once their league shows exist (made here, as the first add would):
//   football/zt-scf  ZT Eagles (9301), ZT Cowboys (9302), ZT Giants (9303), ZT Jets (9304): the Eagles won 2 weeks ago, lost
//                    last week, are on now at the Jets (14–10), then host the Cowboys in 2 days, and play weekly after that
//   basketball/zt-scb ZT Sixers (9401) host the ZT Knicks (9402) three days running from tomorrow (a series), then play them away
//   API (as alex): the search (a team, two teams as a matchup), a team's schedule (opponents' colours), Follow and the couch's
//   teams, the guide's week, the rail (Pick'em first, every game fitting), Play the next game (Pick'em on one game, its spec, its
//   span) and its Undo, Squares on the same game, a draft on the series (both rosters reach it: BACKLOG 220), Pick'em on the rest
//   of the season (and again from the
//   gallery's route with a computer player, its pick of a side in at once: E1b), a sport's season on the
//   couch started by its id, refusals (a game the sport doesn't play, a start with no games left); Sports scores too (the guard:
//   everything while it's off, the mark while it's on) and Show the score moving the mark; each started game's page answering.
//   In a real browser at --width (390): Add a show finds the Eagles (Teams above Shows), their sheet (the plate, Follow, the game
//   on now with only "Started" while scores are hidden, Show the score letting it out, Play the next game the one yellow, Coming
//   up), Start a game… (the team's games added, the gallery on them, Squares on just the next game, Every game left), Squares
//   started and its page; the guide's Sports (the
//   couch's team first, other games by league); Settings' Sports scores too. Nothing wider than the screen, no page errors.
//   Following a league (docs/PLAN-sports-couch.md A3): the API's league follows and your team per league (leagueFollowChecks), and
//   on screen the league sheet's follow row, search's league row with Follow, a league followed alone getting its card, Unfollow
//   on its sheet, and Make them your team on a second team's sheet (leagueFollowBrowser).
//   A league's page (docs/PLAN-sports-couch.md B1): league-now's week dates and the couch's table read (leaguePageChecks); on screen
//   the league card opening the page, This week's table with your team's row and your games after it, the Scores tab, the bar's
//   Follow, and a league followed alone getting its page (leagueFollowBrowser). story-league-page.js shoots its situations.
//   Its Scores tab (B1 session 2): league-now's weeks and game days, the week read of one league alone and a longer week
//   (leaguePageChecks); on screen the switcher on this week, the game on now as a full-width scorebug with its score, the week
//   before (its final), and This week back. Its Games tab (B1 session 3): the couch's starts, your team's season (handing off to Start
//   a game), no results. Its Standings tab (B1 session 4): the standings read (one group, in the league's order, records agreeing
//   with the couch's table; a league with none: null), and on screen the tab with your team's row raised, its record, a row opening
//   its splits and the team's sheet from there, and the whole table held for someone hiding sports scores. Its Chat tab (B1 session 5,
//   migration 0314): the room's API (post to the room and to a game's thread, another member reading both with the thread's game and
//   start, the badge and the read mark, react, edit and delete as the author, someone off the couch refused), and on screen the room,
//   the thread chip, and for someone hiding sports scores the thread's talk since kickoff folded until Show the score.
//
//   npm run dev -- -p 3004   (the sports lane; BASE=http://localhost:3004)
//   node scripts/dev-test/check-sports-couch.js <outDir> [--width=390] [--keep] [--api | --browser] [--pictures]
//
// --pictures: the couch has its own pictures for the ZT football teams (made up here: a coloured disc with ZT on it, never a real
// logo; docs/PLAN-team-logos.md), so the hub's scores strip, the league card and the league's page draw them in place of the
// marks, and the browser half checks that they do.
//
// Brings new-fixture.js up and takes it down (--keep leaves it); its own rows are keyed on the zt-scf / zt-scb leagues (their
// league shows, seasons, matchups, events, links, follows and games) and the stand-in's "zt-standin:" cache rows, removed at the
// start and the end. Refuses a non-local database. Shares new-fixture's zt_nd_ couch: never run beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-sports-couch runs against a local database only");
const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--")) || path.join(require("os").tmpdir(), "check-sports-couch");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").split("=")[1]);
const keep = args.includes("--keep");
const only = args.includes("--api") ? "api" : args.includes("--browser") ? "browser" : null;
const pictures = args.includes("--pictures");
if (require.main === module) fs.mkdirSync(outDir, { recursive: true });

const FB = "football/zt-scf";
const BB = "basketball/zt-scb";
const LEAGUES = [FB, BB];
const H = 3600_000;
const D = 24 * H;
const now = Date.now();
const at = (ms) => new Date(Math.round((now + ms) / 60_000) * 60_000).toISOString();
const roster = (base, positions) => positions.map((p, i) => ({ id: `${base}${i}`, name: `ZT ${p} ${base}${i}`, position: p }));
const TEAMS = [
  { id: "9301", name: "ZT Eagles", short: "Eagles", location: "ZT Philadelphia", abbreviation: "ZPHI", league: FB, color: "004c54", roster: roster("93010", ["QB", "WR", "RB", "TE"]) },
  { id: "9302", name: "ZT Cowboys", short: "Cowboys", location: "ZT Dallas", abbreviation: "ZDAL", league: FB, color: "041e42", roster: roster("93020", ["QB", "WR", "RB", "TE"]) },
  { id: "9303", name: "ZT Giants", short: "Giants", location: "ZT New York", abbreviation: "ZNYG", league: FB, color: "0b2265", roster: roster("93030", ["QB", "WR", "RB"]) },
  { id: "9304", name: "ZT Jets", short: "Jets", location: "ZT New Jersey", abbreviation: "ZNYJ", league: FB, color: "125740", roster: roster("93040", ["QB", "WR", "RB"]) },
  { id: "9401", name: "ZT Sixers", short: "Sixers", location: "ZT Philly", abbreviation: "ZPHL", league: BB, color: "006bb6", roster: roster("94010", ["G", "G", "G", "F", "F", "F", "C", "C"]) },
  { id: "9402", name: "ZT Knicks", short: "Knicks", location: "ZT Manhattan", abbreviation: "ZNYK", league: BB, color: "f58426", roster: roster("94020", ["G", "G", "G", "F", "F", "F", "C", "C"]) },
];
const EVENTS = [
  { league: FB, id: "93101", at: at(-14 * D), home: "9301", away: "9303", state: "post", score: [24, 17] },
  { league: FB, id: "93102", at: at(-7 * D), home: "9304", away: "9301", state: "post", score: [20, 10] },
  { league: FB, id: "93103", at: at(-1 * H), home: "9304", away: "9301", state: "in", score: [10, 14], records: ["5-5", "7-3"], network: "FOX", clock: { period: 3, display: "6:41", detail: "6:41 - 3rd", possession: "9301", down: "2nd & 7" } },
  { league: FB, id: "93104", at: at(2 * D), home: "9301", away: "9302", state: "pre", records: ["7-3", "6-4"], network: "CBS", odds: { details: "ZPHI -3.5", overUnder: 44.5, spread: -3.5 } },
  { league: FB, id: "93105", at: at(9 * D), home: "9303", away: "9301", state: "pre" },
  { league: FB, id: "93106", at: at(16 * D), home: "9301", away: "9304", state: "pre" },
  { league: FB, id: "93107", at: at(23 * D), home: "9302", away: "9301", state: "pre" },
  { league: FB, id: "93108", at: at(3 * D), home: "9303", away: "9302", state: "pre" },
  { league: BB, id: "94101", at: at(1 * D), home: "9401", away: "9402", state: "pre" },
  { league: BB, id: "94102", at: at(2 * D + H), home: "9401", away: "9402", state: "pre" },
  { league: BB, id: "94103", at: at(3 * D), home: "9401", away: "9402", state: "pre" },
  { league: BB, id: "94104", at: at(8 * D), home: "9402", away: "9401", state: "pre" },
];
const LEAGUE_NAMES = [
  { league: FB, name: "ZT Couch Football League", short: "ZTCF" },
  { league: BB, name: "ZT Couch Basketball", short: "ZTCB" },
];

// The league card's own (docs/PLAN-sports-couch.md A2): a stand-in baseball league in its off-season, apart from LEAGUES so the
// scripts that read them see the two they always have; cleanup takes its rows too.
const MB = "baseball/zt-scm";
const MB_TEAMS = [{ id: "9501", name: "ZT Yankees", short: "Yankees", location: "ZT Bronx", abbreviation: "ZNYY", league: MB, color: "0c2340", roster: roster("95010", ["P", "C", "SS", "CF"]) }];
const MB_NAME = { league: MB, name: "ZT Couch Baseball", short: "ZTCM" };
// The stand-in's football table (B1's Standings): one conference of one division, each line counted from the finals above.
const STANDINGS = { [FB]: { season: "2026", groups: [{ id: "zt-e", name: "ZTC East", abbreviation: "EAST", parent: { id: "zt-c", name: "ZTC Conference", abbreviation: "ZTC" }, teams: ["9304", "9303", "9302", "9301"] }] } };

/**
 * The stand-in's calendars around `now`, for the league card's week (A2): football's weeks with Week 12 holding today (ESPN's own
 * labels, the playoffs' named), basketball's game days from five weeks back (its Monday-to-Sunday weeks), and baseball in its
 * off-season with next season listed (as ESPN's bare scoreboard rolls over), back in about four months.
 */
function calendarsAround(t = now) {
  const day = (ms) => `${new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" })}T08:00Z`;
  const w12 = t - 3 * D;
  const week = (i) => ({ from: day(w12 + (i - 12) * 7 * D), to: day(w12 + (i - 11) * 7 * D) });
  const POST = ["Wild Card", "Divisional Round", "Conference Championship", "Super Bowl"];
  const weeks = [...Array.from({ length: 18 }, (_, i) => ({ type: 2, label: `Week ${i + 1}`, ...week(i + 1) })), ...POST.map((label, i) => ({ type: 3, label, ...week(19 + i) }))];
  // A game every other day through the regular season and the playoffs, as ESPN's calendar lists a whole season (a band's ruler
  // counts the season's weeks from them: docs/design-round/league-art-spec.md; 25 days from five weeks back made it "6 of 7").
  const bbDays = [...Array.from({ length: 88 }, (_, i) => t - 35 * D + i * 2 * D), ...Array.from({ length: 31 }, (_, i) => t + 150 * D + i * 2 * D)].map((ms) => day(ms).slice(0, 10));
  return {
    [FB]: { season: 2026, label: "2026", now: 2, weeks, stages: [{ type: 2, name: "Regular Season", from: weeks[0].from, to: weeks[17].to }, { type: 3, name: "Postseason", from: weeks[18].from, to: weeks[21].to }] },
    [BB]: { season: 2027, label: "2026-27", now: 2, days: bbDays, stages: [{ type: 2, name: "Regular Season", from: day(t - 35 * D), to: day(t + 140 * D) }, { type: 3, name: "Postseason", from: day(t + 150 * D), to: day(t + 210 * D) }] },
    [MB]: { season: 2027, label: "2027", now: 4, days: [], stages: [{ type: 2, name: "Regular Season", from: day(t + 123 * D), to: day(t + 310 * D) }, { type: 3, name: "Postseason", from: day(t + 312 * D), to: day(t + 345 * D) }] },
  };
}

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})` : ""}`);
  if (!ok) failures++;
}

/** Every row of ours: the leagues' shows (their seasons, episodes, follows and games go with them), events, links, follows, cache. */
async function cleanup(pool) {
  const LEAGUES_ = [...LEAGUES, MB];
  const like = LEAGUES_.map((l) => `%:${l}`);
  const { rows: shows } = await pool.query("SELECT id, slug FROM shows WHERE sports_league LIKE ANY($1::text[])", [like]);
  const slugs = shows.map((s) => s.slug);
  if (slugs.length) {
    await pool.query("DELETE FROM leagues WHERE state->'settings'->>'showId' = ANY($1::text[])", [slugs]);
    await pool.query("DELETE FROM season_events WHERE league = ANY($1::text[])", [LEAGUES_]);
    await pool.query("DELETE FROM shows WHERE id = ANY($1::uuid[])", [shows.map((s) => s.id)]);
  }
  await pool.query("DELETE FROM sports_events WHERE league = ANY($1::text[])", [LEAGUES_]);
  await pool.query("DELETE FROM team_follows WHERE league = ANY($1::text[])", [LEAGUES_]);
  await pool.query("DELETE FROM league_follows WHERE league = ANY($1::text[])", [LEAGUES_]);
  await pool.query("DELETE FROM sports_recordings WHERE league = ANY($1::text[])", [LEAGUES_]);
  await pool.query("DELETE FROM sports_watching WHERE league = ANY($1::text[])", [LEAGUES_]).catch(() => {}); // 0451 (C2)
  await pool.query("DELETE FROM sports_laps WHERE league = ANY($1::text[])", [LEAGUES_]).catch(() => {}); // 0452 (C3)
  await pool.query("DELETE FROM chat_messages WHERE sports_league = ANY($1::text[])", [LEAGUES_]);
  await pool.query("DELETE FROM league_chat_reads WHERE league = ANY($1::text[])", [LEAGUES_]);
  await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
  await pool.query("UPDATE user_settings SET hide_sports_scores = false WHERE user_id IN (SELECT id FROM \"user\" WHERE username LIKE 'zt_nd_%')");
}

async function main() {
  const pool = new Pool({ connectionString: DB });
  await cleanup(pool);
  const fx = await fixture.up(pool);
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...MB_TEAMS], leagues: [...LEAGUE_NAMES, MB_NAME], events: EVENTS, calendars: calendarsAround(), standings: STANDINGS });
  const headers = { "x-gys-sports": espn.url };
  // The league shows a first add would make (find.ts reads the lists of any league a show's been made for).
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  for (const l of [...LEAGUE_NAMES, MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
  const alex = fixture.username("alex");
  const me = await signIn({ user: alex, pass: fixture.PASSWORD, headers });
  const couch = fx.couchId;
  const started = { espn };
  if (pictures) await couchPictures(couch);
  try {
    if (only !== "browser") await apiChecks(pool, me, couch, started);
    if (only !== "api") await browserChecks(pool, headers, couch);
  } finally {
    await espn.close();
    await appPool.end?.().catch(() => {});
    if (!keep) {
      await cleanup(pool);
      await fixture.down(pool);
    }
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

/**
 * Following a league (docs/PLAN-sports-couch.md A3; team-follows.ts): following a team follows its league and makes it your team
 * there; a second team isn't, until you make it; your team passes on when it's unfollowed; a league follows alone (no team), and
 * unfollowing one leaves its teams followed; the couch's read names who follows each league; a league nobody lists, or an event
 * sport's, is a 404. Leaves alex following the Eagles and their league, as the checks after it expect.
 */
async function leagueFollowChecks(me, couch) {
  const mine = async () => (await me.call("GET", "/api/sports/follow")).body;
  let f = await mine();
  check(f.leagues?.includes(FB) && f.teams?.find((t) => t.id === "9301")?.myTeam === true, "following a team follows its league, and it's your team there", f);
  await me.call("POST", "/api/sports/follow", { league: FB, team: "9302", follow: true });
  f = await mine();
  check(f.teams?.find((t) => t.id === "9302")?.myTeam === false && f.teams.find((t) => t.id === "9301")?.myTeam, "a second team in the league isn't your team", f.teams);
  const made = await me.call("POST", "/api/sports/follow", { league: FB, team: "9302", myTeam: true });
  check(made.status === 200 && made.body.teams?.filter((t) => t.league === FB && t.myTeam).map((t) => t.id).join() === "9302", "Make them your team: one your team a league", made.body);
  const notFollowed = await me.call("POST", "/api/sports/follow", { league: FB, team: "9303", myTeam: true });
  check(notFollowed.status === 409, "a team you don't follow can't be your team", notFollowed.status);
  await me.call("POST", "/api/sports/follow", { league: FB, team: "9302", follow: false });
  f = await mine();
  check(f.teams?.find((t) => t.id === "9301")?.myTeam === true, "unfollowing your team passes it to the next you followed there", f.teams);
  // A league alone: no team, then off again.
  const lf = await me.call("POST", "/api/sports/follow", { league: BB, follow: true });
  check(lf.status === 200 && lf.body.leagues?.includes(BB) && !lf.body.teams?.some((t) => t.league === BB), "a league follows alone, no team needed", lf.body);
  const ctl = await me.call("GET", `/api/sports/couch?couch=${couch}`);
  const bbFans = ctl.body.leagues?.find((l) => l.league === BB);
  check(bbFans?.you && bbFans.followers.length === 1, "the couch's read names who follows each league", ctl.body.leagues);
  check(ctl.body.teams?.[0]?.id === "9301" && ctl.body.teams[0].myTeam, "the couch's teams: yours first, saying it's your team", ctl.body.teams?.[0]);
  await me.call("POST", "/api/sports/follow", { league: BB, follow: false });
  const off = await me.call("POST", "/api/sports/follow", { league: FB, follow: false });
  check(!off.body.leagues?.includes(FB) && off.body.teams?.some((t) => t.id === "9301"), "unfollowing a league leaves its teams followed", off.body);
  await me.call("POST", "/api/sports/follow", { league: FB, follow: true });
  const golf = await me.call("POST", "/api/sports/follow", { league: "golf/pga", follow: true });
  const nobody = await me.call("POST", "/api/sports/follow", { league: "football/zt-nobody", follow: true });
  check(golf.status === 404 && nobody.status === 404, "an event sport's league, or one nobody lists, can't be followed", [golf.status, nobody.status]);
  const bad = await me.call("POST", "/api/sports/follow", { league: FB, follow: "yes" });
  check(bad.status === 400, "a follow says yes or no", bad.status);
}

/**
 * A league's page (docs/PLAN-sports-couch.md B1): league-now says its week's first and last day, and the couch's table read answers
 * each team's record and last five from its schedule (the Eagles beat the Giants two weeks back and lost at the Jets last week) and
 * the meetings among the teams asked, away first with the winner; a read with no teams, or too many, is refused.
 */
async function leaguePageChecks(me) {
  const ln = (await me.call("GET", `/api/sports/league/now?league=${FB}`)).body;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  check(ln.week === "Week 12" && ln.from && ln.to && ln.from <= day && day <= ln.to, "league-now: the week's first and last day hold today", ln);
  const t = await me.call("GET", `/api/sports/league/teams?league=${FB}&teams=9301,9303,9304`);
  const e = t.body.teams?.find((x) => x.id === "9301");
  check(t.status === 200 && e?.w === 1 && e.l === 1 && e.t === 0 && e.form.map((f) => `${f.id}${f.result}`).join() === "93101W,93102L", "the couch's table: the Eagles 1-1, their last two in order", e);
  const m = e?.meetings?.find((x) => x.id === "93101");
  check(m?.away === "9303" && m.home === "9301" && m.score?.join() === "17,24" && m.winner === "9301" && e.meetings.some((x) => x.id === "93105" && !x.final), "meetings among the teams asked: away first, the winner, the ones to come", e?.meetings);
  const none = await me.call("GET", `/api/sports/league/teams?league=${FB}&teams=`);
  const many = await me.call("GET", `/api/sports/league/teams?league=${FB}&teams=${Array.from({ length: 17 }, (_, i) => 9000 + i).join(",")}`);
  check(none.status === 400 && many.status === 400, "the table read asks for some teams, at most 16", [none.status, many.status]);
  // Scores (B1 session 2): the switcher's weeks and game days, and a week of one league alone, up to 14 days.
  check(ln.weeks?.some((w) => w.label === "Week 12" && w.from === ln.from) && ln.weeks.at(-1)?.label === "Super Bowl" && ln.days?.length === 0, "league-now: football's every week, now's among them", ln.weeks?.map((w) => w.label));
  const bn = (await me.call("GET", `/api/sports/league/now?league=${BB}`)).body;
  check(bn.weeks?.length === 0 && bn.days?.length > 0, "league-now: a daily sport's game days", bn.days?.length);
  const to = new Date(Date.parse(`${ln.from}T12:00:00Z`) + 9 * 86_400_000).toISOString().slice(0, 10);
  const one = await me.call("GET", `/api/sports/week?from=${ln.from}&also=${FB}&only=1&to=${to}`);
  const leagues = new Set((one.body.days ?? []).flatMap((d) => d.games.map((g) => g.league)));
  check(one.status === 200 && one.body.days?.length === 10 && [...leagues].every((l) => l === FB) && leagues.size === 1, "the week read of one league alone, ten days asked", { days: one.body.days?.length, leagues: [...leagues] });
  // Standings (B1 session 4): the league's table, its teams in the league's order (the stand-in lists them unordered), each
  // team's record as the couch's table counts it, our colours on them; a league with no table: null.
  const st = await me.call("GET", `/api/sports/league/standings?league=${FB}`);
  const g = st.body.standings?.groups?.[0];
  const eagles = g?.entries?.find((x) => x.team === "9301");
  check(st.status === 200 && st.body.standings.parents.length === 1 && g?.entries.length === 4 && eagles?.record === `${e?.w}-${e?.l}` && eagles.color === "004c54" && eagles.seed != null, "the standings read: one division, the Eagles' record as the couch's table has it, their colour", { g: g?.entries?.map((x) => [x.short, x.record, x.seed]) });
  const nb = await me.call("GET", `/api/sports/league/standings?league=${BB}`);
  check(nb.status === 200 && nb.body.standings === null, "a league with no table: null", nb.body);
}

/** A league's room (B1 session 5; league-chat.ts): leaves one room message and one thread message from Riley, for the browser. */
async function roomChecks(me, couch) {
  const url = (rest = "") => `/api/sports/league/chat${rest}?league=${encodeURIComponent(FB)}&couch=${couch}`;
  const riley = await signIn({ user: fixture.username("riley"), pass: fixture.PASSWORD, headers: me.headers });
  const live = EVENTS.find((e) => e.id === "93103");
  const room = await me.call("POST", url(), { text: "ZT room: Sunday's here" });
  const said = await riley.call("POST", url(), { text: "ZT thread: what a catch", event: live.id, eventAt: live.at, eventName: "Eagles at Jets" });
  check(room.status === 200 && room.body.message?.event === null && said.status === 200 && said.body.message?.event === "93103" && said.body.message.eventName === "Eagles at Jets", "the room: a message to the room and one in a game's thread", [room.status, said.status, said.body.message?.event]);
  const got = (await me.call("GET", url())).body;
  const t = got.messages?.find((m) => m.id === said.body.message?.id);
  check(got.messages?.length >= 2 && t?.eventAt && Date.parse(t.eventAt) === Date.parse(live.at) && got.you?.canPost, "another member reads both, the thread's game and its start with it", { n: got.messages?.length, t });
  const again = await me.call("GET", url() + `&v=${got.v}`);
  check(again.body.unchanged === true, "an unchanged room answers its version alone (the 5-second poll)");
  const unread = (await me.call("GET", url("/unread"))).body.unread;
  await me.call("POST", url("/read"), { at: t?.at });
  const after = (await me.call("GET", url("/unread"))).body.unread;
  check(unread >= 1 && after === 0, "the badge counts Riley's message, and reading clears it", [unread, after]);
  const react = await me.call("POST", url(`/${said.body.message.id}/react`), { emoji: "🔥" });
  const reacted = (await me.call("GET", url())).body.messages.find((m) => m.id === said.body.message.id);
  // Someone else's (Sam's try at Riley's): refused. The couch's owner (alex here) may change anyone's, as in the show's Chat.
  const sam = await signIn({ user: fixture.username("sam"), pass: fixture.PASSWORD });
  const edit = await sam.call("PATCH", url(`/${said.body.message.id}`), { text: "not mine" });
  const mine = await me.call("PATCH", url(`/${room.body.message.id}`), { text: "ZT room: Sunday's here!" });
  check(react.status === 200 && reacted?.reactions?.["🔥"]?.count === 1 && edit.status === 403 && mine.status === 200, "react; edit your own, not someone else's", [react.status, edit.status, mine.status]);
  const extra = await me.call("POST", url(), { text: "ZT delete me" });
  const del = await me.call("DELETE", url(`/${extra.body.message.id}`));
  check(del.status === 200 && !(await me.call("GET", url())).body.messages.some((m) => m.id === extra.body.message.id), "delete your own");
  // Scores' thread link and This week's line (BACKLOG 254 q, r): counts by game, and the newest few.
  const counts = (await me.call("GET", url("/counts"))).body.counts;
  const latest = (await me.call("GET", url() + "&latest=1")).body.messages;
  check(counts?.["93103"] === 1 && latest?.length >= 2 && !("v" in ((await me.call("GET", url() + "&latest=1")).body)), "the thread counts by game, and the room's newest few", { counts, n: latest?.length });
  const casey = await signIn({ user: fixture.username("casey"), pass: fixture.PASSWORD, headers: me.headers }).catch(() => null);
  const off = casey ? await casey.call("GET", `/api/sports/league/chat?league=${encodeURIComponent(FB)}&couch=00000000-0000-4000-8000-000000000000`) : { status: 404 };
  check(off.status === 404 || off.status === 403, "a couch you're not on: refused", off.status);
}

async function apiChecks(pool, me, couch, started) {
  console.log("— API");
  const s1 = await me.call("GET", `/api/sports/search?q=${encodeURIComponent("zt eagles")}`);
  const eagles = s1.body.teams?.find((t) => t.id === "9301");
  check(!!eagles && eagles.league === FB && eagles.color === "004c54", "search finds the ZT Eagles with their colour", s1.body);
  check(["93103", "93104"].includes(eagles?.next?.id), "their next game: the one on now, or the next to play", eagles?.next);
  const s2 = await me.call("GET", `/api/sports/search?q=${encodeURIComponent("zt cowboys zt eagles")}`);
  check(s2.body.matchup?.teams?.map((t) => t.id).sort().join() === "9301,9302", "two teams in any order are one matchup", s2.body.matchup);

  const sc = await me.call("GET", `/api/sports/schedule?league=${FB}&team=9301`);
  check(sc.status === 200 && sc.body.games?.length === 7 && ["93103", "93104"].includes(sc.body.next), "the Eagles' schedule: 7 games, the next", { n: sc.body.games?.length, next: sc.body.next });
  check(sc.body.games?.find((g) => g.id === "93104")?.opponent?.color === "041e42", "each opponent carries its colour for its mark");

  const f = await me.call("POST", "/api/sports/follow", { league: FB, team: "9301", follow: true });
  check(f.status === 200 && f.body.teams?.some((t) => t.id === "9301" && t.name === "ZT Eagles"), "Follow keeps the team as its list names it", f.body);
  const bad = await me.call("POST", "/api/sports/follow", { league: FB, team: "9999", follow: true });
  check(bad.status === 404, "following a team the list doesn't have is a 404", bad.status);
  const ct = await me.call("GET", `/api/sports/couch?couch=${couch}`);
  check(ct.body.teams?.[0]?.id === "9301" && ct.body.teams[0].you && ct.body.teams[0].followers.length === 1, "the couch's teams: yours first, with who follows", ct.body);
  await leagueFollowChecks(me, couch);
  await leaguePageChecks(me);
  await roomChecks(me, couch);

  const wk = await me.call("GET", `/api/sports/week?also=${FB},${BB}`);
  const games = (wk.body.days ?? []).flatMap((d) => d.games);
  check(games.some((g) => g.id === "93103" && g.state === "in") && games.some((g) => g.id === "94101"), "the guide's week has the game on now and tomorrow's", games.map((g) => g.id));
  // The scores strip's data (docs/PLAN-sports-couch.md A1): each side's record, the network and the line in words (never the book's
  // name), the clock of a game on; and the small live read of a game on, football's ball and down.
  const g4 = games.find((g) => g.id === "93104");
  const g3 = games.find((g) => g.id === "93103");
  check(g4?.network === "CBS" && g4.line === "ZPHI by 3.5" && g4.sides.map((s) => s.record).join() === "6-4,7-3" && !JSON.stringify(g4).includes("ZT Book"), "the week's game: records, network, the line in words, no book", g4);
  check(g3?.clock?.period === 3 && g3.clock.display === "6:41" && g3.line === null, "a game on: its period and clock, no line", g3?.clock);
  const nowRead = await me.call("GET", `/api/sports/now?league=${FB}&event=93103`);
  check(nowRead.status === 200 && nowRead.body.possession === "9301" && nowRead.body.down === "2nd & 7" && nowRead.body.scores?.["9301"] === 14 && JSON.stringify(nowRead.body).length < 600, "the small live read: score, ball and down, small", nowRead.body);

  // Where a league's season is today, for its card in Your shows (A2: league-now.ts): football's own week, a daily sport's
  // Monday-to-Sunday one, the off-season with when it's back; edge-kept, the same for everyone.
  const [fbNow, bbNow, mbNow] = await Promise.all([FB, BB, MB].map((l) => me.call("GET", `/api/sports/league/now?league=${l}`)));
  check(fbNow.status === 200 && fbNow.body.on && fbNow.body.stage === "regular" && fbNow.body.week === "Week 12" && fbNow.body.leagueName === "ZTCF", "a league's now: football's own week", fbNow.body);
  check(bbNow.status === 200 && bbNow.body.on && /^Week \d+$/.test(bbNow.body.week ?? "") && bbNow.body.season === "2026-27", "a league's now: a daily sport's week and its season", bbNow.body);
  check(mbNow.status === 200 && !mbNow.body.on && mbNow.body.week === null && /^\d{4}-\d{2}-\d{2}$/.test(mbNow.body.back ?? ""), "a league's now: the off-season, and when it's back", mbNow.body);
  const fbRaw = await me.raw("GET", `/api/sports/league/now?league=${FB}`);
  check(/public, s-maxage=600/.test(fbRaw.headers.get("cache-control") ?? ""), "a league's now is the same for everyone, kept at the edge", fbRaw.headers.get("cache-control"));

  const rail = await me.call("GET", `/api/sports/start?league=${FB}&count=1`);
  check(rail.body.games?.[0]?.id === "pickem" && rail.body.games.every((g) => !g.why), "the rail: Pick'em first, every game fitting one game", rail.body.games?.map((g) => [g.id, g.why]));
  check(rail.body.games?.some((g) => g.id === "squares"), "squares on a football game");

  // Play the next game: Pick'em on it, one tap, on the team's season (Round 3, 2026-11-18: a team's one-game games share a Games tab,
  // an archive and a record), that game only.
  const p = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9301", games: ["93104"], game: "pickem", tell: false });
  const nextEp = p.body.seasonId ? (await pool.query("SELECT episode FROM season_events WHERE season_id = $1 AND event_id = '93104'", [p.body.seasonId])).rows[0]?.episode : null;
  // The strip's games you play (/api/sports/mine): that one game, by its id, no pick yet.
  const mine = await me.call("GET", "/api/sports/mine");
  check(mine.status === 200 && mine.body.games?.some((x) => x.event === "93104" && x.seasonId === p.body.seasonId && x.pick === null) && !mine.body.games.some((x) => x.event === "93105"), "your games: the Pick'em's one game, no pick yet, not its season's others", mine.body);
  // The league card's (A2): which league each sports season of a game of yours or your couch's is in.
  check(!!p.body.seasonId && mine.body.seasons?.some((x) => x.seasonId === p.body.seasonId && x.league === FB), "your games: their seasons, each with its league", mine.body.seasons);
  check(p.status === 200 && p.body.leagueId && Number.isInteger(nextEp) && p.body.from === nextEp && p.body.to === nextEp && /season/i.test(p.body.season ?? ""), `Play the next game starts Pick'em on that one game, on the Eagles' season (its Game ${nextEp})`, p.body);
  // Its game as the engine reads it (gameOf: the spec, from the league's settings).
  const StateLogic = require("../../src/lib/game/state-logic.js");
  const st = p.body.leagueId ? (await pool.query("SELECT state FROM leagues WHERE id = $1", [p.body.leagueId])).rows[0]?.state : null;
  const game = st ? StateLogic.gameOf(st) : null;
  check(game?.ask?.[0]?.settle?.by === "final" && game?.span?.from === nextEp && game?.span?.to === nextEp, "its game is the sport's Pick'em on that game (settled by the final)", game && { ask: game.ask, span: game.span });
  const u = await me.call("POST", `/api/seasons/${p.body.seasonId}/start?couch=${couch}`, { undo: p.body.leagueId });
  check(u.status === 200, "Undo takes it back", u.body);

  const sq = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9301", games: ["93104"], game: "squares", tell: false });
  check(sq.status === 200 && sq.body.seasonId === p.body.seasonId, "Squares on the same game shares its season", sq.body);
  started.squares = sq.body;
  // The same game from the other side's sheet (the review, B4): the season the couch already plays it on, not the Cowboys' own.
  const other = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9302", games: ["93104"], game: "pickem", tell: false });
  check(other.status === 200 && other.body.seasonId === sq.body.seasonId && /at|vs/i.test(other.body.game ?? ""), "the same game from the Cowboys' sheet joins the season the couch plays it on, the toast naming the game", other.body);
  if (other.body?.leagueId) await me.call("POST", `/api/seasons/${other.body.seasonId}/start?couch=${couch}`, { undo: other.body.leagueId });

  const bs = await me.call("GET", `/api/sports/schedule?league=${BB}&team=9401`);
  const series = bs.body.series?.find((x) => x.games.length === 3);
  check(!!series, "the Sixers' three games against the Knicks are a series", bs.body.series);
  const dr = series ? await me.call("POST", `/api/sports/start?couch=${couch}`, { league: BB, team: "9401", games: series.games, game: "short", tell: false }) : { status: 0 };
  check(dr.status === 200 && dr.body.to - dr.body.from === 2, "a draft on the series runs its three games", dr.body);
  started.draft = dr.body;
  // BACKLOG 220: the series' people (both rosters, filled after the answer) reach the draft, however soon after its start they come.
  if (dr.body?.leagueId) {
    let people = 0;
    for (let i = 0; i < 40 && people < 16; i++) {
      people = ((await pool.query("SELECT state FROM leagues WHERE id = $1", [dr.body.leagueId])).rows[0]?.state?.castaways ?? []).length;
      if (people < 16) await new Promise((r) => setTimeout(r, 500));
    }
    check(people === 16, `the draft on the series has both rosters to pick from (${people} of 16)`);
  }

  const ss = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9301", whole: "season", game: "pickem", tell: false });
  check(ss.status === 200 && ss.body.to > ss.body.from, "Pick'em on the rest of the Eagles' season", ss.body);
  started.season = ss.body;
  // E1b: the same Pick'em started from the gallery's route with a computer player: its pick of a side for the season's first game is
  // in at once (a side's faces from the season's games as the server reads them: answers.ts factFaces).
  const ssGame = ss.body.leagueId ? require("../../src/lib/game/state-logic.js").gameOf((await pool.query("SELECT state FROM leagues WHERE id = $1", [ss.body.leagueId])).rows[0].state) : null;
  const withBot = ssGame ? await me.call("POST", `/api/seasons/${ss.body.seasonId}/start?couch=${couch}`, { spec: ssGame, name: "Pick'em with a computer player", tell: false, bots: 1 }) : { status: 0, body: {} };
  const { rows: botPicks } = withBot.status === 200 ? await pool.query("SELECT question, episode, answer FROM game_answers WHERE league_id = $1", [withBot.body.leagueId]) : { rows: [] };
  check(withBot.status === 200 && botPicks.length >= 1 && botPicks.every((r) => ["9301", "9302", "9303", "9304"].includes(r.answer)), `Pick'em with a computer player: its pick of a side in at once (${botPicks.map((r) => `${r.question}@${r.episode}=${JSON.stringify(r.answer)}`).join(", ")})`, `${withBot.status} ${JSON.stringify(withBot.body).slice(0, 300)}`);
  // E1e: an over/under on the game's own line (the stand-in's 44.5 on 93104) with a computer player: the line kept as it opens inside
  // the start's own write (on its connection: on another, the insert waited on the league row the write holds), its answer in at once.
  const ouSpec = ssGame ? { spec: 1, get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, span: ssGame.span, ask: [{ id: "ou", ask: "Total points: over or under?", answer: "overUnder", points: 1, asked: "each", line: "game", closes: "start", settle: { by: "final", take: "total" } }] } : null;
  const ouBot = ouSpec ? await me.call("POST", `/api/seasons/${ss.body.seasonId}/start?couch=${couch}`, { spec: ouSpec, name: "Over or under with a computer player", tell: false, bots: 1 }) : { status: 0, body: {} };
  const { rows: ouAnswers } = ouBot.status === 200 ? await pool.query("SELECT episode, answer FROM game_answers WHERE league_id = $1", [ouBot.body.leagueId]) : { rows: [] };
  const { rows: ouLines } = ouBot.status === 200 ? await pool.query("SELECT line::float8 AS line FROM question_lines WHERE league_id = $1", [ouBot.body.leagueId]) : { rows: [] };
  check(ouBot.status === 200 && ouLines.some((l) => l.line === 44.5) && ouAnswers.length >= 1 && ouAnswers.every((r) => r.answer === "over" || r.answer === "under"), `an over/under on the game's line with a computer player: the line kept (${ouLines.map((l) => l.line).join(", ")}), its answer in at once (${ouAnswers.map((r) => `${r.episode}=${JSON.stringify(r.answer)}`).join(", ")})`, `${ouBot.status} ${JSON.stringify(ouBot.body).slice(0, 200)}`);
  // A sport's season on the couch, by its id: Pick a few on its next game only.
  const by = ss.body.seasonId ? await me.call("POST", `/api/sports/start?couch=${couch}`, { seasonId: ss.body.seasonId, game: "pickAFew", only: true, tell: false }) : { status: 0 };
  check(by.status === 200 && by.body.from === by.body.to, "a sport's season here starts by its id, its next game only", by.body);
  const wz = ss.body.seasonId ? await me.call("GET", `/api/seasons/${ss.body.seasonId}/start?couch=${couch}&wizard=1`) : { body: {} };
  check(wz.body.sport?.league === FB && !wz.body.blocked, "a sport's league season isn't blocked as not a game yet", { sport: wz.body.sport, blocked: wz.body.blocked });
  const no = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9301", games: ["93104"], game: "roto", tell: false });
  check(no.status === 400, "a game the sport doesn't play here is refused", no);

  // Sports scores too: the guard goes by the mark only while it's on.
  const { seenThrough, EVERYTHING } = jiti("../../src/lib/server/guard.ts");
  const uid = (await pool.query("SELECT id FROM \"user\" WHERE username = $1", [fixture.username("alex")])).rows[0].id;
  check((await seenThrough(uid, sq.body.seasonId)) === EVERYTHING, "sports live by default: everything on a sport's season");
  const on = await me.call("PUT", "/api/me/profile", { hideSportsScores: true });
  check(on.status === 200 && on.body.hideSportsScores === true, "Sports scores too saves", on.body.hideSportsScores);
  check((await seenThrough(uid, sq.body.seasonId)) === 0, "with it on, a sport's season goes by the mark (none yet)");
  const shown = await me.call("POST", "/api/sports/shown", { league: FB, event: "93104" });
  check(shown.status === 200 && shown.body.moved >= 1 && (await seenThrough(uid, sq.body.seasonId)) === nextEp, "Show the score moves the mark to that game", shown.body);
  await me.call("PUT", "/api/me/profile", { hideSportsScores: false });

  // It plays: alex picks the Eagles in the season's first game, the game goes final in the stand-in, the daily refresh keeps the
  // final, and the pick is graded right.
  if (ss.body.leagueId) {
    const q = await me.call("GET", `/api/seasons/${ss.body.seasonId}/answers?league=${ss.body.leagueId}`);
    const winner = q.body.questions?.find((x) => /win/i.test(x.ask ?? x.question?.ask ?? ""));
    check(winner?.faces?.length === 2 && winner.faces.some((f) => /Eagles/.test(f.name)), "Pick'em's question offers the game's two teams", winner?.faces);
    const side = winner?.faces?.find((f) => /Eagles/.test(f.name))?.id;
    const a = winner ? await me.call("POST", `/api/seasons/${ss.body.seasonId}/answers?league=${ss.body.leagueId}`, { answers: { [winner.id]: side } }) : { status: 0, body: q.body };
    const mineNow = await me.call("GET", `/api/seasons/${ss.body.seasonId}/answers?league=${ss.body.leagueId}`);
    check(a.status === 200 && mineNow.body.questions?.find((x) => x.id === winner?.id)?.mine != null, "Pick'em: the pick goes in before kickoff", { a: a.body });
    const ev = started.espn.events.find((e) => e.id === "93104");
    // Its box score, as the summary carries one once it's over (the final is kept with its lines: finals.ts).
    const box = (t) => ({ labels: ["C/ATT", "YDS", "TD"], rows: [{ id: t.roster[0].id, name: t.roster[0].name, position: "QB", stats: ["20/30", "250", "2"] }] });
    Object.assign(ev, { state: "post", score: [27, 20], at: at(-3 * H), box: { 9301: box(TEAMS[0]), 9302: box(TEAMS[1]) } });
    await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
    const { refreshSportsEvents } = jiti("../../src/lib/server/sports/matchup.ts");
    const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");
    const r = await refreshSportsEvents({ providers: sportsProviders({ base: started.espn.url }), only: [ss.body.seasonId] });
    const { saveFinals } = jiti("../../src/lib/server/sports/finals.ts");
    // As of three days on: a box score the sport's reader can't read is kept as none after two (the stand-in's isn't ESPN's own).
    const kept = await saveFinals({ providers: sportsProviders({ base: started.espn.url }), seasons: [ss.body.seasonId], now: new Date(Date.now() + 3 * D) });
    const fin = (await pool.query("SELECT final, lines_at FROM sports_events WHERE league = $1 AND event_id = '93104'", [FB])).rows[0];
    check(!!fin?.final && !!fin.lines_at, "the daily job keeps the game's final and its lines", { r, kept, fin });
    const after = await me.call("GET", `/api/seasons/${ss.body.seasonId}/answers?league=${ss.body.leagueId}&episode=${ss.body.from}`);
    const mine = JSON.stringify(after.body);
    check(/"right":true|"correct":true|"points":1\b/.test(mine), "the pick is graded right once the game is final", mine.slice(400, 2600));
    Object.assign(ev, { state: "pre", score: undefined, box: undefined, at: at(2 * D) });
  }

  // Each started game's page.
  for (const [k, g] of Object.entries(started)) {
    if (!g?.leagueId || k === "espn") continue;
    const r = await me.raw("GET", `/show/${g.seasonId}/game/${g.leagueId}`);
    check(r.status === 200, `the ${k} game's page answers`, r.status);
  }
}

/**
 * Following a league on screen (A3), from the NFL-like league's sheet the card just opened: its follow row first (Following, the
 * line naming the Eagles as why, never the yellow); then Add a show's search for the basketball league: Follow on its row puts it
 * on your shows (its card in Your shows), and the league's sheet says so; Unfollow there takes it off. Then your team: alex follows
 * the Cowboys too, whose sheet offers Make them your team, and once made says "Your ZTCF team". Leaves alex as it found them (the
 * Eagles, their league, no Cowboys, no basketball league).
 */
async function leagueFollowBrowser(page, shot, wide, headers) {
  const me = await signIn({ user: fixture.username("alex"), pass: fixture.PASSWORD, headers });
  // The league's page (B1) keeps its Follow in its bar, as a show's bar does: Following, never yellow.
  const row = await page.evaluate(() => {
    const t = document.querySelector('[data-league-bar] [data-follow-toggle="league-bar"]');
    return { pressed: t?.getAttribute("aria-pressed"), yellow: !!t && /bg-chyron|bg-primary/.test(t.className) };
  });
  check(row.pressed === "true" && !row.yellow, "the league's page: Following in its bar, never yellow", row);
  await shot("7-league-follow-row");

  // Search: the basketball league's row, Follow in the chevron's slot.
  await page.goto(BASE + "/home?page=guide", { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelector("[data-guide-add]")?.scrollIntoView());
  await page.click("[data-guide-add]");
  await page.click('[data-search-scope="all"]');
  await page.fill("[data-add-input]", "zt couch basketball");
  // A league named exactly is search's card (B3), Follow beside its name.
  const lrow = page.locator(`[data-search-card="league"]`);
  const found = await lrow.waitFor({ timeout: 15000 }).then(() => true, () => false);
  check(found, "search finds the league, its card with Follow");
  if (found) {
    const r = await lrow.evaluate((el) => ({ toggle: el.querySelector("[data-follow-toggle]")?.textContent, nested: !!el.querySelector("button button") }));
    check(r.toggle === "Follow" && !r.nested, "the league's card: Follow beside its name, its own button", r);
    await wide("search with a league's Follow");
    await lrow.locator("[data-follow-toggle]").click();
    await page.waitForFunction(() => document.querySelector('[data-search-card="league"] [data-follow-toggle]')?.getAttribute("aria-pressed") === "true", null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    check((await me.call("GET", "/api/sports/follow")).body.leagues?.includes(BB), "Follow on the row follows the league");
    await shot("8-search-league-following");
    // Its card in Your shows, no team needed.
    await page.goto(BASE + "/home", { waitUntil: "load" });
    const card = await page.locator(`[data-your-shows] [data-league-card="${BB}"]`).waitFor({ timeout: 20000 }).then(() => true, () => false);
    check(card, "a league followed alone has its card in Your shows");
    if (card) {
      await page.locator(`[data-league-card="${BB}"]`).click();
      const bar = `[data-league-bar="${BB}"] [data-follow-toggle]`;
      await page.locator(`${bar}[aria-pressed="true"]`).waitFor({ timeout: 15000 }).catch(() => {});
      check((await page.getAttribute(bar, "aria-pressed").catch(() => null)) === "true", "its page opens, Following in its bar");
      const empty = await page.locator("[data-couch-table-empty]").waitFor({ timeout: 15000 }).then(() => true, () => false);
      check(empty, "no team followed there: This week says nobody on the couch follows one");
      await page.click(bar);
      await page.locator(`${bar}[aria-pressed="false"]`).waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      check(!(await me.call("GET", "/api/sports/follow")).body.leagues?.includes(BB), "Unfollow in the page's bar stops following the league");
      await shot("9-league-unfollowed");
    }
  }
  await me.call("POST", "/api/sports/follow", { league: BB, follow: false });

  // Your team: a second team in the league offers Make them your team; made, it says so.
  await me.call("POST", "/api/sports/follow", { league: FB, team: "9302", follow: true });
  await page.goto(BASE + "/home?page=guide", { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelector("[data-guide-add]")?.scrollIntoView());
  await page.click("[data-guide-add]");
  await page.click('[data-search-scope="all"]');
  await page.fill("[data-add-input]", "zt cowboys");
  // The team the words name is search's card (B3): its name opens the page.
  await page.waitForSelector('[data-search-open="team"]', { timeout: 15000 });
  await page.click('[data-search-open="team"]');
  const make = await page.locator("[data-make-my-team]").waitFor({ timeout: 15000 }).then(() => true, () => false);
  check(make, "a second team you follow in a league offers Make them your team");
  await shot("10-team-make-mine");
  if (make) {
    await page.click("[data-make-my-team]");
    await page.locator("[data-team-follow][data-my-team]").waitFor({ timeout: 8000 }).catch(() => {});
    const line = await page.textContent("[data-team-follow-line]");
    check(/^Your ZTCF team/.test(line) && !(await page.$("[data-make-my-team]")), "made, the sheet says it's your team", line);
    check((await me.call("GET", "/api/sports/follow")).body.teams?.find((t) => t.id === "9302")?.myTeam === true, "the Cowboys are your team in the league");
    await shot("11-team-is-mine");
  }
  await page.keyboard.press("Escape");
  await me.call("POST", "/api/sports/follow", { league: FB, team: "9302", follow: false });
  await me.call("POST", "/api/sports/follow", { league: FB, follow: true });
}

/** --pictures: made-up pictures (a disc in the team's colour with ZT on it) for the ZT football teams, on the couch. */
async function couchPictures(couch) {
  const sharp = require("sharp");
  const { compose } = require("../couch-team-pictures.js");
  const { setCouchPicture, teamKey } = jiti("../../src/lib/server/couch-pictures.ts");
  const { rows } = await new Pool({ connectionString: DB }).query("SELECT user_id FROM couch_members WHERE couch_id = $1 LIMIT 1", [couch]);
  for (const [id, fill] of [["9301", "004c54"], ["9302", "041e42"], ["9303", "0b2265"], ["9304", "125740"]]) {
    const disc = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><ellipse cx="150" cy="100" rx="140" ry="90" fill="#${fill}"/><text x="150" y="125" font-size="80" text-anchor="middle" fill="#fff" font-family="Arial">ZT</text></svg>`)).png().toBuffer();
    await setCouchPicture(couch, teamKey(FB, id), { bytes: await compose(disc, fill), type: "image/webp" }, rows[0].user_id, "load");
  }
}

async function browserChecks(pool, headers, couch) {
  console.log(`— browser at ${width}`);
  await pool.query("INSERT INTO user_settings (user_id) SELECT id FROM \"user\" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING", [fixture.username("alex")]);
  await pool.query("UPDATE user_settings SET hide_sports_scores = true WHERE user_id = (SELECT id FROM \"user\" WHERE username = $1)", [fixture.username("alex")]);
  // Alex follows the Eagles (the API half does too; --browser alone starts here).
  await (await signIn({ user: fixture.username("alex"), pass: fixture.PASSWORD, headers })).call("POST", "/api/sports/follow", { league: FB, team: "9301", follow: true });
  // And the Yankees, in their off-season (the league card's one line, A2).
  await (await signIn({ user: fixture.username("alex"), pass: fixture.PASSWORD, headers })).call("POST", "/api/sports/follow", { league: MB, team: "9501", follow: true });
  const { page, errors, close } = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, headers });
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}-${width}.png`), fullPage: false });
  const wide = async (what) => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(w[0] <= w[1], `${what}: nothing wider than the screen`, w);
  };
  try {
    // The hub's scores strip (docs/PLAN-sports-couch.md A1): right after On TV, its height; the Scoreboard gone from Your shows and
    // the sports cards from On TV, so a game is on the hub once; scores hidden, the game on says only Started, no numbers.
    await page.goto(BASE + "/home", { waitUntil: "load" });
    await page.locator("[data-scores-strip]").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const hub = await page.evaluate(() => {
      const s = document.querySelector("[data-scores-strip]");
      const tv = document.querySelector("[data-on-tv]");
      const bug = s?.querySelector('[data-bug="93103"]');
      return {
        strip: s?.getBoundingClientRect().height,
        tv: tv?.getBoundingClientRect().height,
        after: !!tv && tv.nextElementSibling === s,
        scoreboard: document.querySelectorAll("[data-scoreboard], [data-score-card]").length,
        tvSports: document.querySelectorAll('[data-on-tv] [data-guide-card^="sport:"]').length,
        bucket: bug?.getAttribute("data-bucket"),
        words: bug?.textContent ?? "",
      };
    });
    check(hub.strip === 88 && hub.tv === 88 && hub.after, "the scores strip: right after On TV, at its height (88 px)", hub);
    check(hub.scoreboard === 0 && hub.tvSports === 0, "no Scoreboard in Your shows, no sports cards in On TV", hub);
    // A kickoff's minutes ("Started 2:10 PM") are never the score: neither number counts next to a colon.
    check(hub.bucket === "started" && /Started/.test(hub.words) && !/(?<!:)\b14\b(?!:\d)|(?<!:)\b10\b(?!:\d)|6:41|Q3/.test(hub.words), "scores hidden: the game on says Started, no score, clock or quarter", hub.words);
    await wide("the hub with the strip");
    await shot("0-hub-strip-hidden");
    await page.click('[data-bug="93103"]');
    check(await page.locator('[data-score-ask="93103"]').isVisible({ timeout: 5000 }).catch(() => false), "a hidden game's bug asks before anything shows");
    await page.keyboard.press("Escape");
    // BACKLOG 254 (k): until the profile read answers, Hide sports scores isn't known, and every sports screen holds results. The
    // profile held back (up to 8 s): the strip's game on still says Started, and a league's page shows no record.
    let release = () => {};
    const held = new Promise((r) => (release = r));
    const hold = async (route) => {
      await Promise.race([held, new Promise((r) => setTimeout(r, 8000))]);
      await route.continue().catch(() => {});
    };
    await page.route("**/api/me/profile", hold);
    try {
      await page.goto(BASE + "/home", { waitUntil: "load" });
      await page.locator('[data-bug="93103"]').waitFor({ timeout: 8000 });
      const early = await page.evaluate(() => {
        const bug = document.querySelector('[data-bug="93103"]');
        return { bucket: bug?.getAttribute("data-bucket"), label: bug?.getAttribute("aria-label") ?? "", words: bug?.textContent ?? "" };
      });
      check(early.bucket === "started" && !/14 to 10|third quarter/.test(early.label), "before the profile answers: the strip's game on says Started, no score", early);
      await page.goto(BASE + `/league/${FB}/week`, { waitUntil: "load" });
      await page.locator("[data-couch-table]").waitFor({ timeout: 8000 });
      const table = (await page.textContent("[data-couch-table]")) ?? "";
      check(!/\b\d{1,2}[–-]\d{1,2}\b/.test(table), "before the profile answers: a league's table shows no record", table.slice(0, 160));
    } finally {
      release();
      await page.unroute("**/api/me/profile", hold);
    }
    // Scores shown: the strip's game on is live, its score, quarter, clock, the ball and the down from the small live read.
    await pool.query("UPDATE user_settings SET hide_sports_scores = false WHERE user_id = (SELECT id FROM \"user\" WHERE username = $1)", [fixture.username("alex")]);
    await page.goto(BASE + "/home", { waitUntil: "load" });
    await page.locator('[data-bug="93103"][data-bucket="live"]').waitFor({ timeout: 30_000 });
    await page.locator('[data-bug="93103"] [data-bug-ball]').waitFor({ timeout: 20_000 }).catch(() => {});
    const liveBug = await page.getAttribute('[data-bug="93103"]', "aria-label");
    check(/14 to 10/.test(liveBug) && /third quarter, 6:41/.test(liveBug) && /Eagles' ball, 2nd and 7/.test(liveBug) && (await page.locator('[data-scores-strip] [data-bug-live]').count()) === 1 && /1 live/.test(await page.textContent("[data-scores-open]")), "scores shown: the game on is live, with its score, clock, ball and down", liveBug);
    await shot("10-hub-strip-live");
    if (pictures) {
      // The couch's own pictures (PLAN-team-logos.md): the strip's bugs and the league card draw them in place of the marks.
      await page.locator("[data-scores-strip] [data-bug-picture]").first().waitFor({ timeout: 20_000 }).catch(() => {});
      const drawn = await page.evaluate(() => ({
        strip: document.querySelectorAll("[data-scores-strip] [data-bug-picture]").length,
        card: document.querySelectorAll("[data-your-shows] [data-league-card] img[src*='/pictures?key=']").length,
      }));
      check(drawn.strip >= 2 && drawn.card >= 1, `(--pictures) the couch's pictures in the strip's bugs (${drawn.strip}) and the league card (${drawn.card})`, drawn);
    }
    // The league's band in Your shows (A2, then docs/design-round/league-art-spec.md): among the show bands and their height, 126 px,
    // in its art (football's own photo by default: league-art.ts), the league, its week, the couch's teams as marks on its season's
    // ruler (the Eagles yours, ringed), one line; never a live score or red. The Yankees' league in its off-season: the same 126 px,
    // Arena (baseball has no photo of its own yet), when it's back, the Yankees' mark at the foot, no ruler.
    await page.locator(`[data-your-shows] [data-league-card="${FB}"]`).waitFor({ timeout: 20_000 });
    const cards = await page.evaluate(([fb, mb]) => {
      const c = document.querySelector(`[data-your-shows] [data-league-card="${fb}"]`);
      const off = document.querySelector(`[data-your-shows] [data-league-card="${mb}"]`);
      const band = c?.closest("[data-your-shows]")?.querySelector("[data-band]");
      return {
        h: c?.getBoundingClientRect().height,
        bandH: band?.getBoundingClientRect().height ?? null,
        words: c?.textContent ?? "",
        art: c?.getAttribute("data-art"),
        img: c?.querySelector("img")?.getAttribute("src") ?? null,
        ruler: c?.querySelector("[data-league-ruler]")?.getAttribute("data-league-ruler") ?? null,
        you: !!c?.querySelector('[data-league-ruler] [data-league-mark="you"]'),
        red: !!c?.querySelector('[class*="bg-live"], [class*="text-live"]'),
        offH: off?.getBoundingClientRect().height,
        offOn: off?.hasAttribute("data-league-off"),
        offArt: off?.getAttribute("data-art"),
        offWords: off?.textContent ?? "",
        offMark: !!off?.querySelector("[data-league-mark]"),
        offRuler: !!off?.querySelector("[data-league-ruler]"),
        among: !!band,
      };
    }, [FB, MB]);
    check(cards.h === 126 && cards.bandH === 126 && /ZTCF/.test(cards.words) && /Week 12/.test(cards.words) && cards.you && !cards.red && !/14|6:41/.test(cards.words), "the league's band: 126 px as a show's, its league and week, your team's mark on its ruler, no score, no red", cards);
    check(cards.art === "football-night-v1" && /football-night-v1-wide\.webp$/.test(cards.img ?? "") && cards.ruler === "12", "the band wears football's own photo, and its ruler stands at week 12", cards);
    check(cards.among, "the league's band sits among the show bands");
    check(cards.offH === 126 && cards.offOn && cards.offArt === "event-night-v1" && /Off-season/.test(cards.offWords) && /back /.test(cards.offWords) && cards.offMark && !cards.offRuler, "off-season: the same 126 px in Arena, when it's back, the Yankees' mark, no ruler", cards);
    // B1: the tap opens the league's page on This week: the couch's table with your team's row, your games in the league after the
    // table (the API half started Squares on the Eagles' season), then starting another.
    await page.locator(`[data-league-card="${FB}"]`).click();
    const paged = await page.locator(`[data-league-bar="${FB}"]`).waitFor({ timeout: 15000 }).then(() => true, () => false);
    check(paged && page.url().endsWith(`/league/${FB}/week`), "a tap opens the league's page on This week", page.url());
    await page.locator('[data-couch-team="9301"]').waitFor({ timeout: 20000 }).catch(() => {});
    const lead = await page.evaluate(() => {
      const t = document.querySelector("[data-couch-table]");
      const y = document.querySelector("[data-league-yours]");
      const w = document.querySelector("[data-league-start]");
      const after = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { mine: !!document.querySelector('[data-couch-team="9301"][data-yours]'), rows: y?.querySelectorAll("[data-open-row]").length ?? 0, order: after(t, y) && after(y, w) };
    });
    check(lead.mine && (only !== null || (lead.rows > 0 && lead.order)), "This week: your team's row, then your games in the league, then starting one", lead);
    await wide("the league's page");
    await shot("6b-league-page");
    // League art (docs/design-round/league-art-spec.md): the bar wears the band's art; its gear opens Your settings for the league,
    // your band as Your shows has it over the art's choices (football: Under the lights, then Arena); a tap repaints the band and
    // the bar and saves it (GET /api/me/league-art's `mine`), and the choice is put back after. The couch's pick and uploads have
    // their own check (check-league-art.js).
    const barArt = await page.getAttribute(`[data-league-bar="${FB}"]`, "data-art");
    check(barArt === "football-night-v1" && (await page.locator(`[data-league-bar="${FB}"] img`).count()) === 1, "the league's bar wears its art", barArt);
    await page.click("[data-league-gear]");
    const opened = await page.locator("[data-league-settings-band] [data-league-preview]").waitFor({ timeout: 15000 }).then(() => true, () => false);
    const choices = await page.$$eval("[data-art-choice]", (els) => els.map((e) => `${e.getAttribute("data-art-choice")}${e.getAttribute("aria-pressed") === "true" ? "*" : ""}`));
    check(opened && page.url().includes("page=you") && choices.join() === "football-night-v1*,event-night-v1", "the gear opens Your settings: your band, then the art's choices, the one in use checked", { url: page.url(), choices });
    await shot("6c-league-settings");
    await page.click('[data-art-choice="event-night-v1"]');
    await page.locator('[data-league-settings-band] [data-league-preview][data-art="event-night-v1"]').waitFor({ timeout: 10000 }).catch(() => {});
    const picked = await page.evaluate(async (fb) => ({
      preview: document.querySelector("[data-league-settings-band] [data-league-preview]")?.getAttribute("data-art"),
      bar: document.querySelector(`[data-league-bar="${fb}"]`)?.getAttribute("data-art"),
      checked: document.querySelector('[data-art-choice][aria-pressed="true"]')?.getAttribute("data-art-choice"),
      saved: (await (await fetch("/api/me/league-art")).json()).mine?.[fb] ?? null,
    }), FB);
    check(picked.preview === "event-night-v1" && picked.bar === "event-night-v1" && picked.checked === "event-night-v1" && picked.saved === "event-night-v1", "Arena tapped: the band and the bar repaint, and it's saved", picked);
    await shot("6d-league-settings-arena");
    const refused = await page.evaluate(async () => (await fetch("/api/me/league-art", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ league: "baseball/zt-scm", art: "football-night-v1" }) })).status);
    check(refused === 400, "a baseball league can't wear football's photo (400)", refused);
    await page.evaluate(async (fb) => fetch("/api/me/league-art", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ league: fb, art: null }) }), FB);
    await page.goBack();
    await page.locator(`[data-league-bar="${FB}"]`).waitFor({ timeout: 10000 }).catch(() => {});
    await page.click('nav[aria-label="League"] a[href$="/scores"]');
    check(await page.locator("[data-scores-switcher]").waitFor({ timeout: 15000 }).then(() => true, () => false), "its Scores tab: the week switcher");
    await page.locator('[data-league-scores] [data-bug="93103"]').waitFor({ timeout: 15000 }).catch(() => {});
    const sc = await page.evaluate(() => {
      const chosen = document.querySelector('[data-step][aria-pressed="true"]');
      const bug = document.querySelector('[data-league-scores] [data-bug="93103"]');
      return { now: chosen?.hasAttribute("data-now"), bucket: bug?.getAttribute("data-bucket"), h: bug ? Math.round(bug.getBoundingClientRect().height) : 0, w: bug ? Math.round(bug.getBoundingClientRect().width) : 0, label: bug?.getAttribute("aria-label") ?? "" };
    });
    check(sc.now && sc.bucket === "live" && sc.h === 72 && sc.w > 300 && /14 to 10/.test(sc.label), "Scores opens on this week, the game on now a full-width scorebug with its score", sc);
    const prev = await page.evaluate(() => {
      const all = [...document.querySelectorAll("[data-step]")];
      const i = all.findIndex((e) => e.hasAttribute("data-now"));
      all[i - 1]?.click();
      return all[i - 1]?.getAttribute("data-step");
    });
    const last = await page.locator('[data-league-scores] [data-bug="93102"]').waitFor({ timeout: 15000 }).then(() => page.locator('[data-league-scores] [data-bug="93102"]').getAttribute("data-bucket"), () => null);
    check(!!prev && last === "final", "the week before: its final", { prev, last });
    await page.click("[data-scores-now]");
    check(await page.locator('[data-step][aria-pressed="true"][data-now]').waitFor({ timeout: 5000 }).then(() => true, () => false), "This week takes it back to now");
    // Games (B1 session 3): your games here, the couch's starts, your team's season; its Start a game hands off.
    await page.click('nav[aria-label="League"] a[href$="/games"]');
    await page.locator("[data-league-games-tab]").waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const gt = await page.evaluate(() => ({
      couch: !!document.querySelector("[data-games-couch] [data-league-start]"),
      team: !!document.querySelector('[data-games-team-season="9301"]'),
      results: /\b\d+[–-]\d+\b/.test(document.querySelector("[data-league-games-tab]")?.textContent ?? ""),
    }));
    check(gt.couch && gt.team && !gt.results, "its Games tab: the couch's starts, your team's season, no results", gt);
    await page.click('[data-games-team-season="9301"]');
    check(await page.locator("[data-sport-handoff]").waitFor({ timeout: 10000 }).then(() => true, () => false), "a team's season row hands off to Start a game");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    // Standings (B1 session 4): the table, your team's row raised with its record; a row opens its splits, and the team's page (B2).
    await page.click('nav[aria-label="League"] a[href$="/standings"]');
    const rowAt = page.locator('[data-standing-row="9301"]');
    const drawn = await rowAt.waitFor({ timeout: 15000 }).then(() => true, () => false);
    const sr = drawn ? await page.evaluate(() => {
      const r = document.querySelector('[data-standing-row="9301"]');
      return { yours: r?.hasAttribute("data-yours"), label: r?.getAttribute("aria-label") ?? "", h: r?.getBoundingClientRect().height, rows: document.querySelectorAll("[data-standing-row]").length };
    }) : null;
    check(!!sr && sr.yours && /W-L \d+-\d+/.test(sr.label) && sr.rows === 4 && sr.h >= 44 && sr.h <= 64, "its Standings tab: four rows, the Eagles yours with their record (faces on the line under the name)", sr);
    await wide("the Standings tab");
    await shot("standings");
    await rowAt.click();
    check(await page.locator('[data-standings-splits="9301"]').waitFor({ timeout: 5000 }).then(() => true, () => false), "a row opens its splits in place");
    await page.click('[data-standings-team="9301"]');
    check(await page.locator('[data-team-page="' + FB + '/9301"]').waitFor({ timeout: 15000 }).then(() => true, () => false), "Open the Eagles: the team's page");
    await page.click("[data-team-back]");
    check(await page.locator('[data-standing-row="9301"]').waitFor({ timeout: 15000 }).then(() => true, () => false), "the team's Back returns to Standings");
    // Chat (B1 session 5): the room, its thread chip for the game on now; then hidden (below) folds the thread's talk.
    await page.click('nav[aria-label="League"] a[href$="/chat"]');
    const roomUp = await page.locator("[data-league-chat] [data-msg]").first().waitFor({ timeout: 15000 }).then(() => true, () => false);
    const roomSeen = roomUp ? await page.evaluate(() => ({ text: document.querySelector("[data-league-chat]")?.textContent ?? "", chip: !!document.querySelector('[data-threads] [data-thread="93103"]'), about: document.querySelector("[data-about]")?.getAttribute("data-about") })) : null;
    check(!!roomSeen && /Sunday's here/.test(roomSeen.text) && /what a catch/.test(roomSeen.text) && roomSeen.chip && roomSeen.about === "93103", "its Chat tab: the room, the thread's chip, About the game on now over the composer", roomSeen);
    await wide("the Chat tab");
    await shot("chat");
    await leagueFollowBrowser(page, shot, wide, headers);
    // Seen live on the strip counts as shown for the visit (scores.tsx noteSeen): forget it, so the sheet below starts hidden.
    await page.evaluate(() => sessionStorage.removeItem("gys-shown-scores"));
    await pool.query("UPDATE user_settings SET hide_sports_scores = true WHERE user_id = (SELECT id FROM \"user\" WHERE username = $1)", [fixture.username("alex")]);
    // Standings hidden: one Show over the whole table, no row and no record drawn.
    await page.goto(BASE + `/league/${FB}/standings`, { waitUntil: "load" });
    const tableHeld = await page.locator("[data-standings-hidden]").waitFor({ timeout: 15000 }).then(() => true, () => false);
    check(tableHeld && (await page.locator("[data-standing-row]").count()) === 0 && !/\b\d+-\d+\b/.test((await page.textContent("[data-league-tab]")) ?? ""), "scores hidden: the Standings tab holds the whole table behind one Show");
    // Chat hidden: Riley's talk in the game's thread since kickoff is one fold; Show the score lets it out.
    await page.goto(BASE + `/league/${FB}/chat`, { waitUntil: "load" });
    const folded = await page.locator('[data-room-fold="93103"]').waitFor({ timeout: 15000 }).then(() => true, () => false);
    check(folded && !/what a catch/.test((await page.textContent("[data-league-chat]")) ?? "") && /Sunday's here/.test((await page.textContent("[data-league-chat]")) ?? ""), "scores hidden: the thread's talk since kickoff folded, the room's shown");
    if (folded) {
      await page.click("[data-room-fold-show]");
      check(await page.getByText("what a catch").waitFor({ timeout: 5000 }).then(() => true, () => false), "Show the score unfolds the thread's talk");
      await page.evaluate(() => sessionStorage.removeItem("gys-shown-scores"));
    }
    // The guide is its own page over the hub now (?page=guide), its Add a show in its header. Waits for its button, not for the
    // network to go quiet: here the hub's sports reads stay open past 30 s in this browser (on A2's code too; BACKLOG 254 g).
    await page.goto(BASE + "/home?page=guide", { waitUntil: "load" });
    await page.locator("[data-guide-add]").first().waitFor({ timeout: 30000 });
    await page.evaluate(() => document.querySelector("[data-guide-add]")?.scrollIntoView());
    await page.click("[data-guide-add]");
    await page.click('[data-search-scope="all"]');
    await page.fill("[data-add-input]", "zt eagles");
    await page.waitForSelector('[data-hit-kind="team"]', { timeout: 15000 });
    const order = await page.evaluate(() => {
      const t = document.querySelector("[data-search-card], [data-sports-results]");
      const s = document.querySelector("[data-search-results]");
      return t && s ? !!(t.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
    });
    check(order !== false, "a team the words name comes above the shows");
    await shot("1-search");
    // A team from search opens its page (B2), Add left behind.
    await page.click('[data-hit-kind="team"]');
    await page.waitForSelector("[data-team-page]", { timeout: 20000 });
    await page.waitForSelector("[data-team-now] [data-bug]", { timeout: 15000 });
    const live = await page.textContent("[data-team-now]");
    check(/Started/.test(live) && !/14|10–|–10/.test(live), "scores hidden: the game on now says only when it started", live);
    check(!(await page.$("[data-season-strip]")) && !!(await page.$("[data-season-hidden]")), "scores hidden: the season held behind Show the season");
    const plate = await page.textContent("[data-team-plate]");
    check(!/\d+–\d+/.test(plate), "scores hidden: no record on the plate", plate);
    check(!/\b(W|L) \d|\d+–\d+/.test((await page.textContent("[data-team-schedule]")) ?? ""), "scores hidden: no result in the schedule");
    check(!!(await page.$('[data-play="next"]')), "Play the next game is there");
    const yellows = await page.$$eval("[data-team-page] .bg-chyron", (els) => els.length);
    check(yellows === 1, "one yellow on the team's page", yellows);
    await wide("the team's page");
    await shot("2-team-hidden");
    await page.click("[data-team-now] [data-bug]");
    await page.locator("[data-show-fresh]").click({ timeout: 10000 }).catch(() => {});
    await page.waitForFunction(() => /14/.test(document.querySelector("[data-team-now]")?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
    check(/14/.test(await page.textContent("[data-team-now]")), "Show the score lets that game's score out", (await page.textContent("[data-team-now]"))?.slice(0, 80));
    await page.keyboard.press("Escape");
    await page.click("[data-show-season]");
    check(await page.locator("[data-season-strip]").waitFor({ timeout: 5000 }).then(() => true, () => false), "Show the season draws the season's bars");
    // Start a game on (docs/PLAN-start-a-game-redo.md B1): the team's games added, then the same gallery as a show's on that season,
    // every game opening on just the next one (what The next game picked).
    await page.click('[data-open-row="scope-next"]');
    await page.waitForSelector("[data-gallery=gallery]", { timeout: 30000 });
    const sq = page.locator('[data-gallery-base="sp-squares"], [data-gallery-lead="sp-squares"]').first();
    await sq.scrollIntoViewIfNeeded();
    await sq.click();
    await page.waitForSelector("[data-gallery=base]", { timeout: 15000 });
    const card = await page.textContent("[data-gallery-title]");
    check(/Squares/i.test(card), "the game's screen names the game picked", card.slice(0, 80));
    check((await page.locator("[data-gallery-option=length-next][data-chosen]").count()) === 1, "Start a game…'s Next game: it opens on just the next game");
    await wide("Start a game on a team");
    await shot("3-start");
    await page.locator("[data-gallery-option=length-rest]").click();
    check(/Every game left/.test(await page.textContent("[data-gallery-length]")), "the rest reads as its games (Every game left)");
    await page.locator("[data-gallery-option=length-next]").click();
    await page.click("[data-gallery-start]");
    await page.waitForURL(/\/game\//, { timeout: 20000 });
    await page.waitForSelector("[data-game-title]", { timeout: 20000 });
    await shot("4-squares-page");
    check(/\/game\//.test(page.url()), "Start it lands on the game's page");
    const title = await page.textContent("[data-game-title]");
    check(!/\bGa\b/.test(title), "the page's unit is the sport's (G, never Ga)", title);

    // A draft on the Sixers' series: its page, a player's position beside their name, and their game log.
    const me = await signIn({ user: fixture.username("alex"), pass: fixture.PASSWORD, headers });
    const bs = await me.call("GET", `/api/sports/schedule?league=${BB}&team=9401`);
    const series = bs.body.series?.find((x) => x.games.length === 3);
    const dr = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: BB, team: "9401", games: series?.games ?? [], game: "short", tell: false });
    if (dr.body.seasonId) {
      const qb = TEAMS[4].roster[0];
      await pool.query(
        `INSERT INTO game_lines (season_id, episode, provider, athlete, name, team, tables) VALUES ($1, 1, 'espn', $2, $3, 'ZT Sixers', $4::jsonb) ON CONFLICT DO NOTHING`,
        [dr.body.seasonId, qb.id, qb.name, JSON.stringify([{ name: null, labels: ["PTS", "REB", "AST"], values: ["21", "7", "5"] }])]
      );
      const hiddenLog = await me.call("GET", `/api/seasons/${dr.body.seasonId}/player-log?name=${encodeURIComponent(qb.name)}`);
      check(hiddenLog.body.games?.length === 0 && hiddenLog.body.newer, "scores hidden: a game log waits for Show the score", hiddenLog.body);
      await me.call("POST", "/api/sports/shown", { league: BB, event: series.games[0] });
      const log = await me.call("GET", `/api/seasons/${dr.body.seasonId}/player-log?name=${encodeURIComponent(qb.name)}`);
      check(log.body.games?.[0]?.items?.some((i) => i.label === "PTS" && i.value === "21"), "a player's game log: each game's line", log.body);
      await page.goto(`${BASE}/show/${dr.body.seasonId}/game/${dr.body.leagueId}`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-game-title]", { timeout: 20000 });
      await wide("a draft's page");
      await shot("6-draft-page");
    } else check(false, "the draft on the series starts", dr.body);

    // The guide is its own page over the hub now (?page=guide), its Add a show in its header.
    await page.goto(BASE + "/home?page=guide", { waitUntil: "networkidle" });
    await page.evaluate(() => document.querySelector("[data-guide]")?.scrollIntoView());
    const sports = await page.$('[data-guide-tv-choice="sports"]');
    if (sports) {
      await sports.click();
      await page.waitForSelector("[data-sports-card], [data-sports-league]", { timeout: 15000 });
      check(!!(await page.$('[data-sports-card="93104"]')), "the guide's Sports leads with the couch's team's game");
      await wide("the guide's Sports");
      await shot("5-guide-sports");
      await page.click('[data-guide-tv-choice="couch"]');
    } else check(false, "the guide's Sports switch (no TV listings here: the switch needs them)");

    await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
    check(!!(await page.$('[data-setting="hide-sports-scores"][data-on="on"]')), "Settings: Sports scores too, on");
    check(errors.length === 0, "no page errors", errors.slice(0, 3));
  } finally {
    await close();
  }
}

// Its stand-in world is shared with scripts/dev-test/story-hub-sports.js (the design round's step 7: a live game day on the hub).
module.exports = { STANDINGS, TEAMS, EVENTS, LEAGUE_NAMES, LEAGUES, FB, BB, MB, MB_TEAMS, MB_NAME, calendarsAround, cleanup };

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
