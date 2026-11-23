// Dev-only: Add's search, every situation it claims (docs/PLAN-sports-couch.md B3; the design: docs/design-round/search-spec.md,
// -first-view.md, -shape.md, -check.md), for a design round's screenshot story and for the check. On new-fixture.js's zt_nd couch.
// Two worlds: the stand-in ESPN the league and team stories share (league-story-world.js: Sunday of Week 12, the Eagles on now at
// Riley's Jets; the couch's four teams followed), and real ESPN (real teams, leagues and next games, as anyone would get them).
//   empty       Add opened from the hub, nothing typed (empty), and its Sports scope (empty-sports)
//   team        "zt eagles", the couch's team on now (team-zt); hiding sports scores (team-hidden); real "eagles" (team);
//               "zt jets", Riley's team (team-couch); "zt eagles" while sports is still looking (loading)
//   matchup     real "eagles cowboys" (matchup)
//   league      real "nfl" (league)
//   ambiguous   real "giants" (two leagues' Giants) (ambiguous)
//   show        real "survivor" (show)
//   mixed       real "bear" (a show and a team) (mixed)
//   event       real "golf" and "formula 1" (event-golf, event-f1)
//   none        "zzqx" (none), and on Sports (sports-none)
//   scope       real "giants" on Sports (scope-sports); "eagles" with More shows opened (more-shows)
//   flow        real "eagles cowboys": the card's scorebug tapped, into the game's sheet with Play (flow-game)
//   failed      "zt eagles" with ESPN not answering (failed)
//   firstrun    first run's search, signed out: real "eagles" (firstrun), then the Eagles picked, on the wall (firstrun-wall)
//   studio      team-zt in the light theme (studio)
// --before shoots today's search into the before folder (the same names where it has them).
// Each frame: a .jpg at --width × --height, the sheet's words in a .txt, words on other words as OVERLAP lines (overlaps.json).
//
// Needs: the app (BASE, default :3000) and the zt_nd couch up (--up brings it up). Removes every row it made after (check-sports-couch.js
// cleanup), unless --keep. One check at a time on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-search.js [--before] [--only=team,league] [--up] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");
const world = require("./check-sports-couch");
const { overlapsIn } = require("./overlaps");
const { TEAMS, eventsFor, COUCH, STANDINGS } = require("./league-story-world");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-search runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const BEFORE = has("before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/search/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const run = (n) => !ONLY || ONLY.includes(n);

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
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: eventsFor("gameday"), calendars: world.calendarsAround(), standings: STANDINGS });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const alex = fixture.username("alex");
  try {
    const call = (who, o = {}) => signIn({ user: fixture.username(who), pass: fixture.PASSWORD, headers: o.real ? {} : headers });
    for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
    for (const [who, league, team] of COUCH) await (await call(who)).call("POST", "/api/sports/follow", { league, team, follow: true });

    // A frame: Add opened from the hub (or first run's search, signed out), `q` typed, then `go` inside the sheet.
    const shoot = async (name, { q = "", go, real, first, wait = 3500, hdrs, dialog: inDialog = true, block, slow } = {}) => {
      const b = await open({ user: first ? null : alex, pass: fixture.PASSWORD, width: W, height: H, headers: hdrs ?? (real ? {} : headers), motion: "reduce" });
      try {
        // ESPN not answering: the search's route fails as it would (a 502), everything else as normal.
        if (block) await b.page.route(`**${block}**`, (r) => r.fulfill({ status: 502, body: "{}" }));
        if (slow) await b.page.route(`**${slow}**`, async (r) => { await new Promise((ok) => setTimeout(ok, 20000)); await r.continue().catch(() => {}); });
        if (first) {
          await b.page.goto(`${BASE}/start/1?search`, { waitUntil: "domcontentloaded" });
          await b.page.locator("[data-search-input], [data-add-input]").first().waitFor({ timeout: 45000 });
        } else {
          await b.page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
          await b.page.locator("[data-add-show-poster]").first().waitFor({ timeout: 45000 });
          await b.page.waitForTimeout(1200);
          await b.page.locator("[data-add-show-poster]").first().scrollIntoViewIfNeeded();
          await b.page.locator("[data-add-show-poster]").first().click();
          await b.page.locator("[data-add-input]").waitFor({ timeout: 20000 });
        }
        const input = b.page.locator("[data-add-input], [data-search-input]").first();
        await b.page.waitForTimeout(600);
        if (q) await input.fill(q);
        await b.page.waitForTimeout(wait);
        await go?.(b.page);
        await input.blur().catch(() => {});
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        const dialog = inDialog ? b.page.locator("[role=dialog]").last() : b.page.locator("main, body").first();
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await dialog.innerText().catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const yellow = await b.page.evaluate(() => [...document.querySelectorAll("[role=dialog] *")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20).length);
        console.log(`PASS ${name}  ${yellow} yellow in the sheet${b.errors.length ? `  errors: ${b.errors.slice(0, 2).join(" | ").slice(0, 200)}` : ""}`);
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
      } finally {
        await b.close();
      }
    };
    const scope = (s) => async (pg) => {
      await pg.locator(`[data-search-scope="${s}"]`).click();
      await pg.waitForTimeout(2500);
    };

    if (run("empty")) {
      await shoot("empty");
      if (!BEFORE) await shoot("empty-sports", { real: true, go: scope("sports") });
    }
    if (run("team")) {
      await shoot("team-zt", { q: "zt eagles" });
      await setting(pool, alex, "hide_sports_scores", true);
      await shoot("team-hidden", { q: "zt eagles" });
      await setting(pool, alex, "hide_sports_scores", false);
      await shoot("team", { q: "eagles", real: true });
      if (!BEFORE) {
        await shoot("team-couch", { q: "zt jets" });
        // Sports held back: the search's answer waits 20 s, so the frame catches it looking.
        await shoot("loading", { q: "zt eagles", wait: 1500, slow: "/api/sports/search" });
      }
    }
    if (run("matchup")) await shoot("matchup", { q: "eagles cowboys", real: true });
    if (run("league")) await shoot("league", { q: "nfl", real: true });
    if (run("ambiguous")) await shoot("ambiguous", { q: "giants", real: true });
    if (run("show")) await shoot("show", { q: "survivor", real: true });
    if (run("mixed")) await shoot("mixed", { q: "bear", real: true });
    if (run("event")) {
      await shoot("event-golf", { q: "golf", real: true });
      await shoot("event-f1", { q: "formula 1", real: true });
    }
    if (run("none")) {
      await shoot("none", { q: "zzqx" });
      if (!BEFORE) await shoot("sports-none", { q: "zzqx", go: scope("sports") });
    }
    if (!BEFORE && run("scope")) {
      await shoot("scope-sports", { q: "giants", real: true, go: scope("sports") });
      await shoot("more-shows", { q: "eagles", real: true, go: async (pg) => { await pg.locator("[data-more-shows]").click(); await pg.waitForTimeout(600); await pg.locator("[data-sports-results]").scrollIntoViewIfNeeded(); } });
    }
    if (!BEFORE && run("flow"))
      await shoot("flow-game", {
        q: "eagles cowboys",
        real: true,
        go: async (pg) => {
          await pg.locator('[data-search-card="matchup"] [data-bug]').first().click();
          await pg.locator("[data-game-view], [data-game-sheet]").first().waitFor({ timeout: 20000 });
          await pg.waitForTimeout(2500);
        },
      });
    if (!BEFORE && run("failed")) await shoot("failed", { q: "zt eagles", block: "/api/sports/search" });
    if (run("firstrun")) {
      await shoot("firstrun", { q: "eagles", real: true, first: true });
      if (!BEFORE)
        await shoot("firstrun-wall", {
          q: "eagles",
          real: true,
          first: true,
          dialog: false,
          go: async (pg) => {
            await pg.locator('[data-search-card="team"] [data-search-pick]').click();
            await pg.waitForTimeout(500);
            await pg.keyboard.press("Escape");
            await pg.waitForTimeout(800);
            await pg.locator("[data-pick-team]").scrollIntoViewIfNeeded();
          },
        });
    }
    if (run("studio")) {
      await setting(pool, alex, "theme", "studio");
      await shoot("studio", { q: "zt eagles" });
      await setting(pool, alex, "theme", "night");
    }
  } finally {
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
