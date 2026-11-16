// Dev-only: a live game day on the hub and in the guide, for a design round's screenshot story (the design round's step 7, the
// sports check: docs/design-round/step7-hub-spec.md "Sports"). On new-fixture.js's zt_nd couch and check-sports-couch.js's stand-in
// ESPN (fake-espn.js, by the x-gys-sports header: the real ESPN is never asked): the ZT Eagles on now at the Jets (14–10), hosting
// the Cowboys in two days. Alex follows the Eagles, Riley the Jets, and Alex starts Pick'em on the Eagles' next game, so the hub's
// next thing can be a sports move. Then, as Alex at --width, each frame under --out:
//   sports-hub.jpg            the hub (sports scores shown), .full.jpg the whole page
//   sports-hub-swiped.jpg     its scoreboard swiped to the last card
//   sports-hub-hidden.jpg     the hub with Hide sports scores on
//   sports-guide.jpg          the guide on Couch
//   sports-guide-sports.jpg   the guide's Sports (scores shown), and -hidden with Hide sports scores on
// and their .txt (the page's words). Removes every row it made after (check-sports-couch.js cleanup), unless --keep.
//
// Needs: the app on :3000 (npm run dev; BASE= for another), and the zt_nd couch up (census-app.js --up, or new-fixture.js up);
// --up brings new-fixture.js up first (it restarts the base couch: never beside another check on it).
// Run:   node scripts/dev-test/story-hub-sports.js --out=.ui-atlas/stories/<design>/after/sports [--width=390 --height=844] [--up] [--keep]
//          [--finished]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");
const world = require("./check-sports-couch");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-hub-sports runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/sports-hub"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
// --finished: the Eagles' game ended four hours ago instead of being on now (the user's missed game: watch the recording): the hub
// with its score hidden behind a tap (sports-hub-finished.jpg), the card's ask (-ask.jpg), and after Watch it as if live
// (-recording.jpg: kept on the server, sports_recordings; cleanup deletes it).
const FINISHED = has("finished");

async function hideScores(pool, user, on) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query('UPDATE user_settings SET hide_sports_scores = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)', [user, on]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  await world.cleanup(pool);
  if (has("up")) await fixture.up(pool);
  const events = FINISHED ? world.EVENTS.map((e) => (e.id === "93103" ? { ...e, at: new Date(Date.now() - 4 * 3600_000).toISOString(), state: "post", score: [17, 24] } : e)) : world.EVENTS;
  const espn = await fakeEspn.start({ teams: world.TEAMS, leagues: world.LEAGUE_NAMES, events });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const alex = fixture.username("alex");
  try {
    for (const l of world.LEAGUE_NAMES) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run census-app.js --up, or this with --up)");
    const me = await signIn({ user: alex, pass: fixture.PASSWORD, headers });
    const riley = await signIn({ user: fixture.username("riley"), pass: fixture.PASSWORD, headers });
    await me.call("POST", "/api/sports/follow", { league: world.FB, team: "9301", follow: true });
    await riley.call("POST", "/api/sports/follow", { league: world.FB, team: "9304", follow: true });
    // Jordan the Giants and Sam the Cowboys: this week's Cowboys at Giants is a couch rivalry (opposite sides, no game on it yet).
    const jordan = await signIn({ user: fixture.username("jordan"), pass: fixture.PASSWORD, headers });
    const sam = await signIn({ user: fixture.username("sam"), pass: fixture.PASSWORD, headers });
    await jordan.call("POST", "/api/sports/follow", { league: world.FB, team: "9303", follow: true });
    await sam.call("POST", "/api/sports/follow", { league: world.FB, team: "9302", follow: true });
    const p = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: world.FB, team: "9301", games: ["93104"], game: "pickem", tell: false });
    console.log(p.status === 200 ? `[sports] Pick'em on the Eagles' next game: ${p.body.leagueId}` : `[sports] Pick'em not started (${p.status})`);

    const shoot = async (name, go, full = false) => {
      const b = await open({ user: alex, pass: fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await b.page.locator("[data-hub]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(2500);
        await go(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 82 });
        if (full) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        console.log(`PASS ${name}`);
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
      } finally {
        await b.close();
      }
    };
    const guide = async (pg, choice) => {
      const door = pg.locator("[data-on-tv-open]");
      if (await door.count()) {
        await door.click();
        await pg.locator("[data-guide-page]").waitFor({ timeout: 15000 });
      } else await pg.locator("[data-guide]").first().evaluate((e) => e.scrollIntoView({ block: "start" }));
      if (choice) {
        await pg.locator(`[data-guide-tv-choice="${choice}"]`).last().click();
        await pg.locator("[data-sports-day], [data-sports-guide]").first().waitFor({ timeout: 15000 }).catch(() => {});
      }
      await pg.waitForTimeout(1800);
    };
    await hideScores(pool, alex, false);
    if (FINISHED) {
      const board = async (pg) => {
        await pg.locator("[data-scoreboard]").first().scrollIntoViewIfNeeded();
        await pg.waitForTimeout(800);
      };
      await shoot("sports-hub-finished", board, true);
      await shoot("sports-hub-finished-ask", async (pg) => {
        await pg.locator("[data-score-card][data-ask] button").first().click();
        await pg.locator("[data-score-ask]").first().waitFor({ timeout: 10000 });
        await pg.waitForTimeout(600);
      });
      await shoot("sports-hub-finished-recording", async (pg) => {
        await pg.locator("[data-score-card][data-ask] button").first().click();
        await pg.locator("[data-recording-start]").first().click();
        await pg.locator("[data-score-card] [data-watching]").first().waitFor({ timeout: 10000 });
        await board(pg);
      });
      // Watching it is kept on the server: a fresh page still hides the score.
      await shoot("sports-hub-finished-recording-reload", async (pg) => {
        await pg.locator("[data-score-card] [data-watching]").first().waitFor({ timeout: 10000 });
        await board(pg);
      });
    }
    await shoot("sports-hub", async () => {}, true);
    // The scoreboard swiped to its last card (the rivalry, on this world).
    await shoot("sports-hub-swiped", async (pg) => {
      const strip = pg.locator("[data-scoreboard] .overflow-x-auto").first();
      await strip.scrollIntoViewIfNeeded();
      await strip.evaluate((el) => (el.scrollLeft = el.scrollWidth));
      await pg.waitForTimeout(700);
    });
    await shoot("sports-guide", (pg) => guide(pg, "couch"));
    await shoot("sports-guide-sports", (pg) => guide(pg, "sports"));
    await hideScores(pool, alex, true);
    await shoot("sports-hub-hidden", async () => {});
    await shoot("sports-guide-sports-hidden", (pg) => guide(pg, "sports"));
    // The guide's switch is kept per phone: leave it on Couch for the next run.
    await shoot("sports-guide-reset", (pg) => guide(pg, "couch"));
    fs.rmSync(path.join(OUT, "sports-guide-reset.jpg"), { force: true });
    fs.rmSync(path.join(OUT, "sports-guide-reset.txt"), { force: true });
  } finally {
    await hideScores(pool, alex, false).catch(() => {});
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
