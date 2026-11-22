// Dev-only: a league's page (docs/PLAN-sports-couch.md B1; the design: docs/design-round/league-page-spec.md), every situation of
// its This week tab, for a design round's screenshot story and for the check. On new-fixture.js's zt_nd couch and a stand-in ESPN
// (fake-espn.js, by the x-gys-sports header: the real ESPN is never asked), check-sports-couch.js's ZT leagues with two more
// football teams and a season of finals behind this week (weeks 1 to 11), so records, form and the couch's rivalries are real
// reads of the stand-in's schedules. The couch: alex the Eagles, Riley the Jets, Sam the Cowboys, Jordan the Giants.
//   gameday      Week 12, Sunday: the Eagles on now at the Jets (alex vs Riley, 14-10), Cowboys at Giants later today (alex's
//                Pick'em on it, a pick due), Bears at Lions tonight: the hub's card (gameday-card), its tap: the page (gameday,
//                gameday.full), the Scores tab (gameday-scores), the Games tab (gameday-games), a team row's tap (gameday-team)
//   midweek      the same season, this week's games later in the week: the rivalry before kickoff with Start a game on it
//                (midweek), its tap (midweek-start)
//   hidden       gameday with Hide sports scores on: no numbers, Show records (hidden), and after it's tapped (hidden-shown)
//   lone         alex alone follows a football team: one row, no rivalry (lone)
//   none         nobody follows a football team; alex follows the league: the empty table (none)
//   solo         the solo hub's person (solo-fixture.js's zt_so_alex) following the Eagles and the Lions: Your teams (solo)
//   daily        basketball: the Sixers (alex) and the Knicks (Riley), a game today and tonight (daily)
//   off          baseball in its off-season, alex following the Yankees (off)
//   studio       gameday in the light theme (studio)
// Each frame: a .jpg at --width × --height, the page's words in a .txt, and words that sit on other words as OVERLAP lines (kept in
// overlaps.json). Prints the first view's groups in order, the rivalry's and the table's words, and the page's width.
//
// Needs: the app (BASE, default :3000) and the zt_nd couch up (census-app.js --up, or new-fixture.js up; --up brings it up first).
// Removes every row it made after (check-sports-couch.js cleanup; the solo fixture taken down), unless --keep. One check at a time
// on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-league-page.js --out=.ui-atlas/stories/league-page/after
//          [--only=gameday,hidden] [--width=390 --height=844] [--up] [--keep]
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

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-league-page runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/league-page/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const { FB, BB, MB } = world;
const HR = 3600_000;
const D = 24 * HR;
const now = Date.now();
const at = (ms) => new Date(Math.round((now + ms) / 60_000) * 60_000).toISOString();
const endOfDay = new Date(new Date(now).setHours(22, 30, 0, 0)).getTime() - now;
const today = (ms) => at(Math.max(10 * 60_000, Math.min(ms, endOfDay)));
const TEAMS = [
  ...world.TEAMS,
  { id: "9305", name: "ZT Bears", short: "Bears", location: "ZT Chicago", abbreviation: "ZCHI", league: FB, color: "0b162a" },
  { id: "9306", name: "ZT Lions", short: "Lions", location: "ZT Detroit", abbreviation: "ZDET", league: FB, color: "0076b6" },
];
const [E, C, G, J, B, L] = ["9301", "9302", "9303", "9304", "9305", "9306"];

// Weeks 1 to 11, each [away, home, away's score, home's]: a tie in Week 4, the Eagles' bye in Week 10, the couch's rivalries
// along the way (Giants beat the Eagles in Week 8: alex vs Jordan; Cowboys over the Eagles in Week 7; Jets at Cowboys in Week 8).
const SEASON = [
  [[G, C, 28, 20], [E, B, 21, 17], [J, L, 10, 24]],
  [[C, E, 17, 24], [B, J, 13, 16], [L, G, 20, 23]],
  [[J, G, 19, 26], [E, L, 14, 31], [C, B, 27, 10]],
  [[G, E, 17, 24], [L, C, 21, 21], [B, J, 7, 20]],
  [[E, C, 20, 23], [J, B, 24, 17], [G, L, 10, 30]],
  [[C, J, 26, 19], [B, G, 14, 20], [L, E, 27, 24]],
  [[C, E, 38, 21], [G, J, 13, 16], [L, B, 30, 6]],
  [[G, E, 19, 11], [J, C, 20, 27], [B, L, 17, 24]],
  [[E, J, 23, 20], [C, L, 14, 28], [G, B, 21, 14]],
  [[J, C, 17, 31], [L, G, 20, 27]],
  [[C, G, 10, 17], [E, B, 31, 20], [L, J, 24, 13]],
];
// Week 12 holds today (calendarsAround: from three days back); week i's games a day before its week's end, here.
const weekAt = (i) => (i - 12) * 7 * D - 1 * D;

function footballFor(n, mid) {
  const id = (k) => `96${n}${String(k).padStart(2, "0")}`;
  let k = 0;
  const past = SEASON.flatMap((games, w) => games.map(([away, home, a, h]) => ({ league: FB, id: id(++k), at: at(weekAt(w + 1)), home, away, state: "post", score: [h, a] })));
  const thisWeek = mid
    ? [
        { league: FB, id: id(50), at: at(2 * D + 2 * HR), home: J, away: E, state: "pre", network: "FOX", odds: { details: "ZPHI -2.5", spread: -2.5 } },
        { league: FB, id: id(51), at: at(3 * D), home: G, away: C, state: "pre", network: "CBS" },
        { league: FB, id: id(52), at: at(3 * D + 3 * HR), home: L, away: B, state: "pre", network: "NBC" },
      ]
    : [
        { league: FB, id: id(50), at: at(-1.6 * HR), home: J, away: E, state: "in", score: [10, 14], network: "FOX", clock: { period: 3, display: "6:41", detail: "6:41 - 3rd", possession: E, down: "2nd & 7" } },
        { league: FB, id: id(51), at: today(1.5 * HR), home: G, away: C, state: "pre", network: "CBS", odds: { details: "ZNYG -3", spread: -3 } },
        { league: FB, id: id(52), at: today(4.5 * HR), home: L, away: B, state: "pre", network: "NBC" },
      ];
  const later = [
    { league: FB, id: id(60), at: at(7 * D), home: E, away: G, state: "pre" },
    { league: FB, id: id(61), at: at(7 * D + 3 * HR), home: C, away: J, state: "pre" },
    { league: FB, id: id(62), at: at(14 * D), home: C, away: E, state: "pre" },
    { league: FB, id: id(63), at: at(14 * D + 3 * HR), home: J, away: G, state: "pre" },
  ];
  return [...past, ...thisWeek, ...later];
}

const WORLD_N = { gameday: 1, midweek: 2, hidden: 3, lone: 4, none: 5, solo: 6, daily: 7, off: 8, studio: 9 };
function eventsFor(name) {
  const n = WORLD_N[name];
  if (name === "daily")
    return [
      { league: BB, id: `97${n}01`, at: at(-5 * D), home: "9401", away: "9402", state: "post", score: [112, 104] },
      { league: BB, id: `97${n}02`, at: at(-3 * D), home: "9402", away: "9401", state: "post", score: [99, 101] },
      { league: BB, id: `97${n}03`, at: today(1 * HR), home: "9401", away: "9402", state: "pre", network: "ESPN" },
      { league: BB, id: `97${n}04`, at: at(1 * D + 2 * HR), home: "9402", away: "9401", state: "pre", network: "TNT" },
    ];
  if (name === "off") return [];
  return footballFor(n, name === "midweek");
}
const pickemGame = (name) => eventsFor(name).find((e) => e.id.endsWith("51"))?.id;

const COUCH = [["alex", FB, E], ["riley", FB, J], ["sam", FB, C], ["jordan", FB, G]];

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
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: [], calendars: world.calendarsAround() });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const alex = fixture.username("alex");
  let soloUp = false;
  try {
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run census-app.js --up, or this with --up)");
    const call = (who, o = {}) => signIn({ user: o.user ?? fixture.username(who), pass: o.pass ?? fixture.PASSWORD, headers });

    const setWorld = async (name, follows, o = {}) => {
      await world.cleanup(pool);
      for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
      espn.events.length = 0;
      espn.events.push(...eventsFor(name));
      for (const [who, league, team] of follows) await (await call(who, o)).call("POST", "/api/sports/follow", team ? { league, team, follow: true } : { league, follow: true });
    };
    const pickem = async (eventId) => {
      const me = await call("alex");
      const p = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: C, games: [eventId], game: "pickem", tell: false });
      if (p.status !== 200) console.log(`[league] Pick'em not started (${p.status} ${JSON.stringify(p.body).slice(0, 200)})`);
      return p.body;
    };

    const shoot = async (name, go, o = {}) => {
      const b = await open({ user: o.user ?? alex, pass: o.pass ?? fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + (o.path ?? `/league/${o.league ?? FB}/week`), { waitUntil: "domcontentloaded" });
        await b.page.locator(o.wait ?? "[data-this-week], [data-hub]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(3500);
        await go?.(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        if (o.full) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const info = await b.page.evaluate((h) => {
          const fold = h - 66;
          const groups = [
            ["move", "[data-league-move]"],
            ["rivalry", "[data-rivalry]"],
            ["table", "[data-couch-table]"],
            ["season rivalries", "[data-season-rivalries]"],
            ["your games", "[data-league-games]"],
            ["rest", "[data-league-rest]"],
          ]
            .map(([k, sel]) => [k, document.querySelector(sel)?.getBoundingClientRect()])
            .filter(([, r]) => r && r.height)
            .map(([k, r]) => `${k} ${Math.round(r.top)}-${Math.round(r.bottom)}${r.top < fold ? "" : " (below the fold)"}`);
          const rows = [...document.querySelectorAll("[data-couch-team]")].map((x) => {
            const r = x.getBoundingClientRect();
            return `${Math.round(r.top) < fold ? "" : "below: "}${x.getAttribute("aria-label")}`;
          });
          return {
            wide: document.documentElement.scrollWidth,
            yellow: [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20).length,
            groups,
            rivalry: document.querySelector("[data-rivalry]")?.getAttribute("aria-label") ?? null,
            rows,
          };
        }, H);
        console.log(`PASS ${name}  page ${info.wide} px wide, ${info.yellow} yellow`);
        if (!o.sheet) {
          console.log(`      first view: ${info.groups.join(" · ")}`);
          if (info.rivalry) console.log(`      rivalry: ${info.rivalry}`);
          for (const r of info.rows) console.log(`      row: ${r}`);
        }
        return info;
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
        return null;
      } finally {
        await b.close();
      }
    };
    const run = (n) => !ONLY || ONLY.includes(n);

    if (run("gameday")) {
      await setWorld("gameday", COUCH);
      await pickem(pickemGame("gameday"));
      await shoot(
        "gameday-card",
        async (pg) => {
          const s = pg.locator("[data-your-shows]").first();
          if (await s.count()) await s.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 64)));
          await pg.waitForTimeout(600);
        },
        { path: "/home", wait: "[data-hub]", sheet: true }
      );
      await shoot(
        "gameday",
        async (pg) => {
          await pg.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
          await pg.locator(`[data-league-card="${FB}"]`).first().waitFor({ timeout: 30000 });
          await pg.locator(`[data-league-card="${FB}"]`).first().click();
          await pg.locator("[data-this-week] [data-couch-team]").first().waitFor({ timeout: 20000 });
          await pg.waitForTimeout(1500);
        },
        { full: true, wait: "[data-hub]", path: "/home" }
      );
      await shoot("gameday-scores", async (pg) => {
        await pg.locator('nav[aria-label="League"] a[href$="/scores"]').click();
        await pg.locator("[data-league-days]").waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1500);
      }, { sheet: true });
      await shoot("gameday-games", async (pg) => {
        await pg.locator('nav[aria-label="League"] a[href$="/games"]').click();
        await pg.locator("[data-league-start]").waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
      }, { sheet: true });
      await shoot("gameday-team", async (pg) => {
        await pg.locator(`[data-couch-team="${C}"]`).click();
        await pg.locator("[data-team-view]").waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
      }, { sheet: true });
    }
    if (run("midweek")) {
      await setWorld("midweek", COUCH);
      await shoot("midweek", null, { full: true });
      await shoot("midweek-start", async (pg) => {
        await pg.locator("[data-rivalry-start]").click();
        await pg.waitForTimeout(2500);
      }, { sheet: true });
    }
    if (run("hidden")) {
      await setWorld("hidden", COUCH);
      await pickem(pickemGame("hidden"));
      await setting(pool, alex, "hide_sports_scores", true);
      await shoot("hidden", null, { full: true });
      await shoot("hidden-shown", async (pg) => {
        await pg.locator("[data-show-records]").click();
        await pg.waitForTimeout(1500);
      });
      await setting(pool, alex, "hide_sports_scores", false);
    }
    if (run("lone")) {
      await setWorld("lone", [["alex", FB, E]]);
      await shoot("lone");
    }
    if (run("none")) {
      await setWorld("none", [["alex", FB, null]]);
      await shoot("none");
    }
    if (run("daily")) {
      await setWorld("daily", [["alex", BB, "9401"], ["riley", BB, "9402"]]);
      await shoot("daily", null, { league: BB });
    }
    if (run("off")) {
      await setWorld("off", [["alex", MB, "9501"]]);
      await shoot("off", null, { league: MB });
    }
    if (run("studio")) {
      await setWorld("studio", COUCH);
      await pickem(pickemGame("studio"));
      await setting(pool, alex, "theme", "studio");
      await shoot("studio", null, { full: true });
      await setting(pool, alex, "theme", "night");
    }
    if (run("solo")) {
      await setWorld("solo", []);
      await soloFx.up(pool);
      soloUp = true;
      const so = soloFx.username("alex");
      const soMe = await signIn({ user: so, pass: soloFx.PASSWORD, headers });
      for (const team of [E, L]) await soMe.call("POST", "/api/sports/follow", { league: FB, team, follow: true });
      await shoot("solo", null, { user: so, pass: soloFx.PASSWORD });
    }
  } finally {
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
