// Dev-only: a team's page (docs/PLAN-sports-couch.md B2; the design: docs/design-round/team-page-spec.md, -first-view.md,
// -shape.md, -check.md), every situation it claims, for a design round's screenshot story and for the check. On new-fixture.js's
// zt_nd couch and a stand-in ESPN (fake-espn.js, by the x-gys-sports header), the world story-league-page.js uses
// (league-story-world.js: the ZT football league, a season of finals behind Week 12, the Eagles' bye in Week 10), plus a fuller
// basketball season for the Sixers (homestands and road trips, a game today). The couch: alex the Eagles, Riley the Jets, Sam the
// Cowboys, Jordan the Giants.
//   gameday      the Eagles on now at the Jets (alex vs Riley), alex's Pick'em on their next game (a pick due) and the couch's talk in
//                the game on now's thread: the Eagles' page (gameday, .full), the Cowboys' (Sam's: gameday-other),
//                a schedule row's tap (gameday-game: the game's sheet), and the way there: This week's row (gameday-from) and Back
//                (gameday-back)
//   midweek      this week's games later in the week: the next game first, Play it (midweek, .full)
//   hidden       gameday with Hide sports scores on (hidden, .full), and Show (hidden-shown)
//   daily        basketball: the Sixers' season, a game today: by month (daily, .full), Month view (daily-month), a road trip's games
//   off          baseball's off-season, the stand-in's Yankees with no games (off)
//   solo         the solo hub's person following the Eagles (solo)
//   studio       gameday in the light theme (studio)
//   failed       the stand-in down (failed)
//   real         real ESPN schedules (public league data, the round's "judge on a real game"): the Eagles (real-nfl), the Knicks
//                (real-nba), the Yankees' 2026 season, over (real-mlb, real-mlb-month), alex following each for the shoot (unfollowed after)
// --before shot the old team sheet (opened from This week's row) into the before folder, the same names, on the code before B2 (the
// sheet is gone since; the frames are kept in .ui-atlas/stories/team-page/before/).
// Each frame: a .jpg at --width × --height, the page's words in a .txt, and words on other words as OVERLAP lines (overlaps.json).
//
// Needs: the app (BASE, default :3000) and the zt_nd couch up (census-app.js --up, or new-fixture.js up; --up brings it up first).
// Removes every row it made after (check-sports-couch.js cleanup; the solo fixture taken down), unless --keep. One check at a time
// on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-team-page.js [--before] [--only=gameday,daily]
//          [--out=.ui-atlas/stories/team-page/after] [--width=390 --height=844] [--up] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");
const soloFx = require("./solo-fixture");
const world = require("./check-sports-couch");
const { overlapsIn } = require("./overlaps");
const { now, at, today, HR, D, TEAMS, eventsFor, COUCH, STANDINGS, E, C, FB, BB, MB } = require("./league-story-world");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-team-page runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const BEFORE = has("before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/team-page/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const run = (n) => !ONLY || ONLY.includes(n);

// The Sixers' season (a daily sport): from five weeks back to six weeks on, a game every other day or so, in runs at home and away
// (a homestand, a road trip) against four more stand-in teams; finals behind, one today, the rest to come.
const BB_TEAMS = [
  ["9403", "Celtics", "ZBOS", "007a33"],
  ["9404", "Heat", "ZMIA", "98002e"],
  ["9405", "Bucks", "ZMIL", "00471b"],
  ["9406", "Bulls", "ZCHB", "ce1141"],
].map(([id, short, abbreviation, color]) => ({ id, name: `ZT ${short}`, short, location: `ZT ${short}`, abbreviation, league: BB, color }));
const SIX = "9401";
function sixersSeason() {
  // Each run: home or away, how many games. Then the days between games.
  const runs = [[true, 3], [false, 4], [true, 2], [false, 2], [true, 5], [false, 5], [true, 3], [false, 3], [true, 4], [false, 2]];
  const opps = ["9402", "9403", "9404", "9405", "9406"];
  const out = [];
  let t = -34 * D + 19.5 * HR - (new Date(now).getHours() * HR);
  let k = 0;
  for (const [home, n] of runs)
    for (let i = 0; i < n; i++) {
      const opp = opps[(k * 3 + i) % opps.length];
      const id = `98${String(++k).padStart(3, "0")}`;
      const when = t;
      const isToday = when > -12 * HR && when < 12 * HR;
      const past = !isToday && when < 0;
      // Scores that look like a season (a seeded spread, not a pattern): margins from 1 to about 25, more wins than losses.
      const r = (x) => ((Math.sin(k * 12.9898 + x * 78.233) * 43758.5453) % 1 + 1) % 1;
      const theirs = 96 + Math.round(r(1) * 22), mine = theirs + (r(2) < 0.56 ? 1 : -1) * (1 + Math.round(r(3) ** 1.6 * 24));
      out.push({
        league: BB,
        id,
        at: isToday ? today(1.5 * HR) : at(when),
        home: home ? SIX : opp,
        away: home ? opp : SIX,
        state: past ? "post" : "pre",
        ...(past ? { score: home ? [mine, theirs === mine ? theirs + 3 : theirs] : [theirs === mine ? theirs + 3 : theirs, mine] } : {}),
        ...(isToday ? { network: "ESPN" } : {}),
      });
      t += (i === n - 1 ? 2 : 1 + (k % 3 === 0 ? 1 : 0)) * D;
    }
  return out;
}

// Real ESPN teams for the shoot: league, team id (ESPN's), the frame's name.
const REAL = [
  ["football/nfl", "21", "real-nfl"],
  ["basketball/nba", "18", "real-nba"],
  ["baseball/mlb", "10", "real-mlb"],
];

async function setting(pool, user, col, v) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query(`UPDATE user_settings SET ${col} = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)`, [user, v]);
}

const OVERLAPS = [];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  await world.cleanup(pool);
  if (has("up")) await fixture.up(pool);
  const calendars = world.calendarsAround();
  const eastDay = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  calendars[BB].days = Array.from({ length: 90 }, (_, i) => eastDay(now - 40 * D + i * D));
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...BB_TEAMS, ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: [], calendars, standings: STANDINGS });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const alex = fixture.username("alex");
  let soloUp = false;
  try {
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run census-app.js --up, or this with --up)");
    const call = (who, o = {}) => signIn({ user: o.user ?? fixture.username(who), pass: o.pass ?? fixture.PASSWORD, headers: o.real ? {} : headers });

    const setWorld = async (name, follows, events = eventsFor(name)) => {
      await world.cleanup(pool);
      for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
      espn.down = false;
      espn.events.length = 0;
      espn.events.push(...events);
      for (const [who, league, team] of follows) await (await call(who)).call("POST", "/api/sports/follow", { league, team, follow: true });
    };

    // A frame. After: the team's page by its address. Before: today's sheet, opened from This week's row for the team.
    const shoot = async (name, { league = FB, team = E, go, full, user, pass, real, sheet } = {}) => {
      const b = await open({ user: user ?? alex, pass: pass ?? fixture.PASSWORD, width: W, height: BEFORE && full ? 2400 : H, headers: real ? {} : headers, motion: "reduce" });
      try {
        if (BEFORE) {
          await b.page.goto(`${BASE}/league/${league}/week`, { waitUntil: "domcontentloaded" });
          await b.page.locator(`[data-couch-team="${team}"]`).first().click({ timeout: 45000 });
          await b.page.locator("[data-team-view]").waitFor({ timeout: 30000 });
        } else {
          await b.page.goto(`${BASE}/league/${league}/team/${team}`, { waitUntil: "domcontentloaded" });
          await b.page.locator("[data-team-page], [data-team-page-failed]").first().waitFor({ timeout: 45000 });
        }
        await b.page.waitForTimeout(3000);
        await go?.(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        if (full && !BEFORE) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        const hits = await overlapsIn(b.page, BEFORE && full ? 2400 : H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const info = await b.page.evaluate((h) => {
          const fold = h;
          const groups = [
            ["plate", "[data-team-head]"],
            ["now", "[data-team-now]"],
            ["play", "[data-play]"],
            ["season", "[data-team-season]"],
            ["start", "[data-scopes]"],
            ["schedule", "[data-team-schedule]"],
          ]
            .map(([k, sel]) => [k, document.querySelector(sel)?.getBoundingClientRect()])
            .filter(([, r]) => r && r.height)
            .map(([k, r]) => `${k} ${Math.round(r.top)}-${Math.round(r.bottom)}${r.top < fold ? "" : " (below the fold)"}`);
          return {
            wide: document.documentElement.scrollWidth,
            yellow: [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20).length,
            groups,
          };
        }, H);
        console.log(`PASS ${name}  page ${info.wide} px wide, ${info.yellow} yellow`);
        if (!sheet && info.groups.length) console.log(`      first view: ${info.groups.join(" · ")}`);
        return info;
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
        return null;
      } finally {
        await b.close();
      }
    };
    const scrollTo = (sel) => async (pg) => {
      await pg.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {});
      await pg.waitForTimeout(600);
    };

    // The rows' couch (B2's rows, the user's call of 2026-11-22): a Pick'em of alex's on the Eagles' next game (its pick due), and
    // the couch's talk in the game on now's thread, posted through the room's real route; cleared after.
    const clearRoom = () => pool.query("DELETE FROM chat_messages WHERE sports_league = $1", [FB]).then(() => pool.query("DELETE FROM league_chat_reads WHERE league = $1", [FB]));
    const seedRows = async (name) => {
      const evs = eventsFor(name);
      const next = evs.find((e) => e.state === "pre" && (e.home === E || e.away === E) && Date.parse(e.at) > now);
      const live = evs.find((e) => e.state === "in" && (e.home === E || e.away === E));
      const me = await call("alex");
      if (next) {
        const r = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: E, games: [next.id], game: "pickem", tell: false });
        if (r.status !== 200) console.log(`[team] Pick'em not started (${r.status} ${JSON.stringify(r.body).slice(0, 160)})`);
      }
      if (live) {
        const thread = { event: live.id, eventAt: live.at, eventName: "Eagles at Jets" };
        for (const [who, text] of [["riley", "That catch on third down was unreal"], ["sam", "Refs are asleep"], ["alex", "Fly Eagles fly"]]) {
          const r = await (await call(who)).call("POST", `/api/sports/league/chat?league=${encodeURIComponent(FB)}&couch=${couch}`, { text, ...thread });
          if (r.status !== 200) console.log(`[team] talk not posted (${r.status})`);
        }
      }
    };

    if (run("gameday")) {
      await setWorld("gameday", COUCH);
      if (!BEFORE) {
        await clearRoom();
        await seedRows("gameday");
      }
      await shoot("gameday", { full: true });
      await shoot("gameday-other", { team: C, full: true });
      if (!BEFORE) {
        await shoot("gameday-schedule", { go: scrollTo("[data-team-schedule]") });
        await shoot("gameday-game", {
          sheet: true,
          go: async (pg) => {
            await pg.locator("[data-team-schedule] [data-sched-row]").first().click();
            await pg.locator("[data-game-view]").waitFor({ timeout: 15000 });
            await pg.waitForTimeout(900);
          },
        });
        // The way there and back: This week's row pushes the page; its Back returns to This week.
        const b = await open({ user: alex, pass: fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
        try {
          await b.page.goto(`${BASE}/league/${FB}/week`, { waitUntil: "domcontentloaded" });
          await b.page.locator(`[data-couch-team="${E}"]`).first().waitFor({ timeout: 45000 });
          await b.page.waitForTimeout(2500);
          await b.page.screenshot({ path: path.join(OUT, "gameday-from.jpg"), type: "jpeg", quality: 84 });
          await b.page.locator(`[data-couch-team="${E}"]`).first().click();
          await b.page.locator("[data-team-page]").waitFor({ timeout: 30000 });
          const pushed = b.page.url();
          await b.page.locator("[data-team-back]").click();
          await b.page.locator("[data-this-week]").waitFor({ timeout: 30000 });
          await b.page.waitForTimeout(1500);
          await b.page.screenshot({ path: path.join(OUT, "gameday-back.jpg"), type: "jpeg", quality: 84 });
          console.log(`PASS flow  This week → ${pushed.replace(BASE, "")} → Back → ${b.page.url().replace(BASE, "")}`);
        } catch (e) {
          console.log(`FAIL flow: ${e.message.split("\n")[0]}`);
        } finally {
          await b.close();
        }
      }
    }
    await clearRoom();
    if (run("midweek")) {
      await setWorld("midweek", COUCH);
      await shoot("midweek", { full: true });
    }
    if (run("hidden")) {
      await setWorld("hidden", COUCH);
      await setting(pool, alex, "hide_sports_scores", true);
      await shoot("hidden", { full: true });
      if (!BEFORE)
        await shoot("hidden-shown", {
          full: true,
          go: async (pg) => {
            await pg.locator("[data-show-season]").click();
            await pg.waitForTimeout(1500);
          },
        });
      await setting(pool, alex, "hide_sports_scores", false);
    }
    if (run("daily")) {
      await setWorld("daily", [["alex", BB, SIX], ["riley", BB, "9402"]], sixersSeason());
      await shoot("daily", { league: BB, team: SIX, full: true });
      if (!BEFORE) {
        await shoot("daily-month", {
          league: BB,
          team: SIX,
          full: true,
          go: async (pg) => {
            await pg.locator('[data-sched-view="month"]').click();
            await pg.waitForTimeout(1200);
          },
        });
        await shoot("daily-trip", {
          league: BB,
          team: SIX,
          go: async (pg) => {
            await pg.locator("[data-sched-run]").first().scrollIntoViewIfNeeded();
            await pg.waitForTimeout(600);
          },
        });
      }
    }
    if (run("off")) {
      await setWorld("off", [["alex", MB, "9501"]], []);
      await shoot("off", { league: MB, team: "9501" });
    }
    if (run("studio")) {
      await setWorld("studio", COUCH);
      await setting(pool, alex, "theme", "studio");
      await shoot("studio", { full: true });
      await setting(pool, alex, "theme", "night");
    }
    if (run("solo") && !BEFORE) {
      await setWorld("solo", [], eventsFor("gameday"));
      await soloFx.up(pool);
      soloUp = true;
      const so = soloFx.username("alex");
      const soMe = await signIn({ user: so, pass: soloFx.PASSWORD, headers });
      await soMe.call("POST", "/api/sports/follow", { league: FB, team: E, follow: true });
      await shoot("solo", { user: so, pass: soloFx.PASSWORD, full: true });
    }
    if (run("failed") && !BEFORE) {
      await setWorld("failed", COUCH);
      espn.down = true;
      await shoot("failed", { team: "9301" });
      espn.down = false;
    }
    if (run("real")) {
      await setWorld("real", [], []);
      const me = await call("alex", { real: true });
      try {
        for (const [league, team, name] of REAL) {
          await me.call("POST", "/api/sports/follow", { league, team, follow: true });
          await shoot(name, { league, team, real: true, full: true });
          if (!BEFORE && league === "baseball/mlb")
            await shoot(`${name}-month`, {
              league,
              team,
              real: true,
              full: true,
              go: async (pg) => {
                await pg.locator('[data-sched-view="month"]').click();
                await pg.waitForTimeout(1200);
              },
            });
        }
      } finally {
        for (const [league, team] of REAL) {
          await me.call("POST", "/api/sports/follow", { league, team, follow: false }).catch(() => {});
          await me.call("POST", "/api/sports/follow", { league, follow: false }).catch(() => {});
        }
      }
    }
  } finally {
    await pool.query("DELETE FROM chat_messages WHERE sports_league = $1", [FB]).catch(() => {});
    if (soloUp) await soloFx.down(pool).catch((e) => console.log(`solo fixture not taken down: ${e.message}`));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 1));
    await setting(pool, alex, "hide_sports_scores", false).catch(() => {});
    await setting(pool, alex, "theme", "night").catch(() => {});
    await espn.close();
    await appPool.end?.().catch(() => {});
    if (!has("keep")) await world.cleanup(pool);
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
