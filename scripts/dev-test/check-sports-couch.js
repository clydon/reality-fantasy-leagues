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
//   span) and its Undo, Squares on the same game, a draft on the series, Pick'em on the rest of the season, a sport's season on the
//   couch started by its id, refusals (a game the sport doesn't play, a start with no games left); Sports scores too (the guard:
//   everything while it's off, the mark while it's on) and Show the score moving the mark; each started game's page answering.
//   In a real browser at --width (390): Add a show finds the Eagles (Teams above Shows), their sheet (the plate, Follow, the game
//   on now with only "Started" while scores are hidden, Show the score letting it out, Play the next game the one yellow, Coming
//   up), Start a game… (When it runs, the rail, the white card, Start it), Squares started and its page; the guide's Sports (the
//   couch's team first, other games by league); Settings' Sports scores too. Nothing wider than the screen, no page errors.
//
//   npm run dev -- -p 3004   (the sports lane; BASE=http://localhost:3004)
//   node scripts/dev-test/check-sports-couch.js <outDir> [--width=390] [--keep] [--api | --browser]
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
fs.mkdirSync(outDir, { recursive: true });

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
  { id: "9401", name: "ZT Sixers", short: "Sixers", location: "ZT Philly", abbreviation: "ZPHL", league: BB, color: "006bb6", roster: roster("94010", ["G", "G", "F", "F", "C"]) },
  { id: "9402", name: "ZT Knicks", short: "Knicks", location: "ZT Manhattan", abbreviation: "ZNYK", league: BB, color: "f58426", roster: roster("94020", ["G", "G", "F", "F", "C"]) },
];
const EVENTS = [
  { league: FB, id: "93101", at: at(-14 * D), home: "9301", away: "9303", state: "post", score: [24, 17] },
  { league: FB, id: "93102", at: at(-7 * D), home: "9304", away: "9301", state: "post", score: [20, 10] },
  { league: FB, id: "93103", at: at(-1 * H), home: "9304", away: "9301", state: "in", score: [10, 14] },
  { league: FB, id: "93104", at: at(2 * D), home: "9301", away: "9302", state: "pre", odds: { details: "ZPHI -3.5", overUnder: 44.5, spread: -3.5 } },
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

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})` : ""}`);
  if (!ok) failures++;
}

/** Every row of ours: the leagues' shows (their seasons, episodes, follows and games go with them), events, links, follows, cache. */
async function cleanup(pool) {
  const like = LEAGUES.map((l) => `%:${l}`);
  const { rows: shows } = await pool.query("SELECT id, slug FROM shows WHERE sports_league LIKE ANY($1::text[])", [like]);
  const slugs = shows.map((s) => s.slug);
  if (slugs.length) {
    await pool.query("DELETE FROM leagues WHERE state->'settings'->>'showId' = ANY($1::text[])", [slugs]);
    await pool.query("DELETE FROM season_events WHERE league = ANY($1::text[])", [LEAGUES]);
    await pool.query("DELETE FROM shows WHERE id = ANY($1::uuid[])", [shows.map((s) => s.id)]);
  }
  await pool.query("DELETE FROM sports_events WHERE league = ANY($1::text[])", [LEAGUES]);
  await pool.query("DELETE FROM team_follows WHERE league = ANY($1::text[])", [LEAGUES]);
  await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
  await pool.query("UPDATE user_settings SET hide_sports_scores = false WHERE user_id IN (SELECT id FROM \"user\" WHERE username LIKE 'zt_nd_%')");
}

async function main() {
  const pool = new Pool({ connectionString: DB });
  await cleanup(pool);
  const fx = await fixture.up(pool);
  const espn = await fakeEspn.start({ teams: TEAMS, leagues: LEAGUE_NAMES, events: EVENTS });
  const headers = { "x-gys-sports": espn.url };
  // The league shows a first add would make (find.ts reads the lists of any league a show's been made for).
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  for (const l of LEAGUE_NAMES) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
  const alex = fixture.username("alex");
  const me = await signIn({ user: alex, pass: fixture.PASSWORD, headers });
  const couch = fx.couchId;
  const started = {};
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

  const wk = await me.call("GET", `/api/sports/week?also=${FB},${BB}`);
  const games = (wk.body.days ?? []).flatMap((d) => d.games);
  check(games.some((g) => g.id === "93103" && g.state === "in") && games.some((g) => g.id === "94101"), "the guide's week has the game on now and tomorrow's", games.map((g) => g.id));

  const rail = await me.call("GET", `/api/sports/start?league=${FB}&count=1`);
  check(rail.body.games?.[0]?.id === "pickem" && rail.body.games.every((g) => !g.why), "the rail: Pick'em first, every game fitting one game", rail.body.games?.map((g) => [g.id, g.why]));
  check(rail.body.games?.some((g) => g.id === "squares"), "squares on a football game");

  // Play the next game: Pick'em on it, one tap.
  const p = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9301", games: ["93104"], game: "pickem", tell: false });
  check(p.status === 200 && p.body.leagueId && p.body.from === 1 && p.body.to === 1, "Play the next game starts Pick'em on that one game", p.body);
  // Its game as the engine reads it (gameOf: the spec, from the league's settings).
  const StateLogic = require("../../src/lib/game/state-logic.js");
  const st = p.body.leagueId ? (await pool.query("SELECT state FROM leagues WHERE id = $1", [p.body.leagueId])).rows[0]?.state : null;
  const game = st ? StateLogic.gameOf(st) : null;
  check(game?.ask?.[0]?.settle?.by === "final" && game?.span?.from === 1 && game?.span?.to === 1, "its game is the sport's Pick'em on that game (settled by the final)", game && { ask: game.ask, span: game.span });
  const u = await me.call("POST", `/api/seasons/${p.body.seasonId}/start?couch=${couch}`, { undo: p.body.leagueId });
  check(u.status === 200, "Undo takes it back", u.body);

  const sq = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9301", games: ["93104"], game: "squares", tell: false });
  check(sq.status === 200 && sq.body.seasonId === p.body.seasonId, "Squares on the same game shares its season", sq.body);
  started.squares = sq.body;

  const bs = await me.call("GET", `/api/sports/schedule?league=${BB}&team=9401`);
  const series = bs.body.series?.find((x) => x.games.length === 3);
  check(!!series, "the Sixers' three games against the Knicks are a series", bs.body.series);
  const dr = series ? await me.call("POST", `/api/sports/start?couch=${couch}`, { league: BB, team: "9401", games: series.games, game: "short", tell: false }) : { status: 0 };
  check(dr.status === 200 && dr.body.to - dr.body.from === 2, "a draft on the series runs its three games", dr.body);
  started.draft = dr.body;

  const ss = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9301", whole: "season", game: "pickem", tell: false });
  check(ss.status === 200 && ss.body.to > ss.body.from, "Pick'em on the rest of the Eagles' season", ss.body);
  started.season = ss.body;
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
  check(shown.status === 200 && shown.body.moved >= 1 && (await seenThrough(uid, sq.body.seasonId)) === 1, "Show the score moves the mark to that game", shown.body);
  await me.call("PUT", "/api/me/profile", { hideSportsScores: false });

  // Each started game's page.
  for (const [k, g] of Object.entries(started)) {
    if (!g?.leagueId) continue;
    const r = await me.raw("GET", `/show/${g.seasonId}/game/${g.leagueId}`);
    check(r.status === 200, `the ${k} game's page answers`, r.status);
  }
}

async function browserChecks(pool, headers, couch) {
  console.log(`— browser at ${width}`);
  await pool.query("INSERT INTO user_settings (user_id) SELECT id FROM \"user\" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING", [fixture.username("alex")]);
  await pool.query("UPDATE user_settings SET hide_sports_scores = true WHERE user_id = (SELECT id FROM \"user\" WHERE username = $1)", [fixture.username("alex")]);
  const { page, errors, close } = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, headers });
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}-${width}.png`), fullPage: false });
  const wide = async (what) => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(w[0] <= w[1], `${what}: nothing wider than the screen`, w);
  };
  try {
    await page.goto(BASE + "/home", { waitUntil: "networkidle" });
    await page.evaluate(() => document.querySelector("[data-guide-add]")?.scrollIntoView());
    await page.click("[data-guide-add]");
    await page.fill("[data-add-input]", "zt eagles");
    await page.waitForSelector('[data-hit-kind="team"]', { timeout: 15000 });
    const order = await page.evaluate(() => {
      const t = document.querySelector("[data-sports-results]");
      const s = document.querySelector("[data-search-results]");
      return t && s ? !!(t.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
    });
    check(order !== false, "a team the words name comes above the shows");
    await shot("1-search");
    await page.click('[data-hit-kind="team"]');
    await page.waitForSelector("[data-team-view]", { timeout: 15000 });
    await page.waitForSelector("[data-live-now]", { timeout: 15000 });
    const live = await page.textContent("[data-live-now]");
    check(/Started/.test(live) && !/14|10–|–10/.test(live), "scores hidden: the game on now says only when it started", live);
    check(!(await page.$("[data-team-form]")), "scores hidden: no form strip");
    const plate = await page.textContent("[data-team-plate]");
    check(!/\d+–\d+/.test(plate), "scores hidden: no record on the plate", plate);
    check(!!(await page.$('[data-play="next"]')), "Play the next game is there");
    const yellows = await page.$$eval("[role=dialog] .bg-chyron", (els) => els.length);
    check(yellows === 1, "one yellow on the team's sheet", yellows);
    await wide("the team's sheet");
    await shot("2-team-hidden");
    await page.click("[data-live-now] [data-show-score]");
    await page.waitForFunction(() => /14/.test(document.querySelector("[data-live-now]")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
    check(/14/.test(await page.textContent("[data-live-now]")), "Show the score lets that game's score out");
    await page.click('[data-more="start"]');
    await page.waitForSelector("[data-sport-start] [data-sport-game]", { timeout: 15000 });
    await page.click('[data-sport-game="squares"]');
    const card = await page.textContent("[data-start-card]");
    check(/Squares/.test(card), "the white card names the game picked", card.slice(0, 80));
    await wide("Start a game on a team");
    await shot("3-start");
    await page.click("[data-sport-mode=season]");
    check(/games/.test(await page.textContent("[data-start-readout]")), "Rest of season reads as its games");
    await page.click("[data-sport-mode=next]");
    await page.click("[data-start-go]");
    await page.waitForURL(/\/game\//, { timeout: 20000 });
    await page.waitForLoadState("networkidle");
    await shot("4-squares-page");
    check(/\/game\//.test(page.url()), "Start it lands on the game's page");

    await page.goto(BASE + "/home", { waitUntil: "networkidle" });
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
