// Dev-only: Round 3's sports check (docs/design-round/round3-short-games-spec.md, "A sport's daily games"): a team's daily games as
// one-game games on the couch's Games tab, Tonight and a game's page. On new-fixture.js's zt_nd couch and check-sports-couch.js's
// stand-in ESPN (fake-espn.js, by the x-gys-sports header: the real ESPN is never asked): the ZT Sixers host the ZT Knicks three days
// running from tomorrow. Alex starts Pick'em on each of the three games, one game each (and, with --squares, Squares on the first),
// then, as alex at --width, under --out:
//   sport-games.jpg      the Sixers season's Games tab (.full.jpg, .txt)
//   sport-tonight.jpg    its Tonight
//   sport-game.jpg       the first game's own page
// Every game here is still to come: the stand-in has no finished basketball game, and a sport's results come from the daily listings
// job (sports/finals.ts), which this world doesn't run forward. Removes every row it made after (check-sports-couch.js cleanup),
// unless --keep.
//
// Needs: the app (BASE), and the zt_nd couch up (--up brings new-fixture.js up first; never beside another check on it).
// Run:   node scripts/dev-test/story-sport-daily.js --out=.ui-atlas/stories/round3-short-games/sport [--width=390 --height=844] [--up] [--keep] [--squares]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");
const world = require("./check-sports-couch");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-sport-daily runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/round3-short-games/sport"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  await world.cleanup(pool);
  if (has("up")) await fixture.up(pool);
  const espn = await fakeEspn.start({ teams: world.TEAMS, leagues: world.LEAGUE_NAMES, events: world.EVENTS });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const alex = fixture.username("alex");
  let failed = 0;
  try {
    for (const l of world.LEAGUE_NAMES) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run with --up)");
    const me = await signIn({ user: alex, pass: fixture.PASSWORD, headers });
    await me.call("POST", "/api/sports/follow", { league: world.BB, team: "9401", follow: true });
    const daily = world.EVENTS.filter((e) => e.league === world.BB && e.home === "9401" && e.away === "9402").slice(0, 3);
    let seasonId = null;
    let firstGame = null;
    for (const e of daily) {
      const p = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: world.BB, team: "9401", games: [e.id], game: "pickem", tell: false });
      console.log(p.status === 200 ? `[sport] Pick'em on ${e.id}: ${p.body.leagueId}` : `[sport] Pick'em on ${e.id} not started (${p.status} ${JSON.stringify(p.body).slice(0, 160)})`);
      if (p.status === 200) {
        seasonId = seasonId ?? p.body.seasonId;
        firstGame = firstGame ?? p.body.leagueId;
      }
    }
    if (has("squares") && daily[0]) {
      const q = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: world.BB, team: "9401", games: [daily[0].id], game: "squares", tell: false });
      console.log(q.status === 200 ? `[sport] Squares on ${daily[0].id}` : `[sport] Squares not started (${q.status})`);
    }
    if (!seasonId) throw new Error("no game started");
    const shots = [
      { id: "sport-games", go: `/show/${seasonId}/games`, ready: "[data-whats-on], [data-tab=\"games\"]" },
      { id: "sport-tonight", go: `/show/${seasonId}`, ready: "[data-your-games], main section" },
      { id: "sport-game", go: `/show/${seasonId}/game/${firstGame}`, ready: "[data-game-page]" },
    ];
    for (const s of shots) {
      const b = await open({ user: alex, pass: fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + s.go, { waitUntil: "networkidle", timeout: 90000 });
        await b.page.locator(s.ready).first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(2000);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${s.id}.jpg`), type: "jpeg", quality: 84 });
        await b.page.screenshot({ path: path.join(OUT, `${s.id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${s.id}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        for (const [x, y] of await overlapsIn(b.page, H)) console.log(`OVERLAP ${s.id}: "${x}" on "${y}"`);
        if (b.errors.length) console.log(`ERRORS ${s.id}: ${b.errors.slice(0, 3).join(" | ")}`);
        console.log(`PASS ${s.id}`);
      } catch (e) {
        failed++;
        console.log(`FAIL ${s.id}: ${e.message.split("\n")[0]}`);
        await b.page.screenshot({ path: path.join(OUT, `${s.id}.fail.jpg`), type: "jpeg" }).catch(() => {});
      } finally {
        await b.close();
      }
    }
  } finally {
    await espn.close?.();
    if (!has("keep")) await world.cleanup(pool);
    await pool.end();
    await appPool.end?.();
  }
  console.log(failed ? `${failed} FAILED` : "ALL CAPTURED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
