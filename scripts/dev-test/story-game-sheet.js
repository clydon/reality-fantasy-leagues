// Dev-only: a game's sheet with Play (docs/PLAN-sports-couch.md B4; the design: docs/design-round/game-sheet-spec.md, -first-view.md,
// -shape.md, -check.md), every situation it claims, for a design round's screenshot story and for the check. On new-fixture.js's
// zt_nd couch and the stand-in ESPN world the league and team stories share (league-story-world.js: Sunday of Week 12, the Eagles on
// now at Riley's Jets, Cowboys at Giants later today). Each frame opens a team's page and taps one of its schedule rows (the sheet
// opens the same from every game row).
//   pre          Cowboys at Giants later today, from the Cowboys' page, with Riley's Pick'em already on it (pre), and with none (pre-none)
//   types        pre-none with Squares chosen (types)
//   bigger       pre-none scrolled to Go bigger (bigger)
//   rivalry      midweek: the Eagles at Riley's Jets before kickoff (rivalry)
//   live         the Eagles at the Jets on now (live), and hiding sports scores (live-hidden)
//   final        the Eagles' last final, at the Bears (final)
//   daily        the Sixers' game tomorrow (daily)
//   solo         the solo hub's person on the Eagles' next game (solo)
//   studio       pre in the light theme (studio)
//   real         a real ESPN game: the Eagles' next (real-nfl), alex following them for the shoot (unfollowed after)
// --before shoots today's sheet into the before folder (the same names where it has them).
// Each frame: a .jpg at --width × --height, the page's words in a .txt, words on other words as OVERLAP lines (overlaps.json).
//
// Needs: the app (BASE, default :3000) and the zt_nd couch up (--up brings it up). Removes every row it made after (check-sports-couch.js
// cleanup), unless --keep. One check at a time on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-game-sheet.js [--before] [--only=pre,live] [--up] [--keep]
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
const { now, at, today, D, HR, TEAMS, eventsFor, COUCH, STANDINGS, E, C, G, J, FB, BB } = require("./league-story-world");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-game-sheet runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const BEFORE = has("before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/game-sheet/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const run = (n) => !ONLY || ONLY.includes(n);

// A daily sport: the Sixers and the Knicks, two games in a row (a series) from tomorrow, one behind.
const SIX = "9401", NYK = "9402";
const daily = () => [
  { league: BB, id: "98901", at: at(-3 * D), home: SIX, away: NYK, state: "post", score: [112, 104] },
  { league: BB, id: "98902", at: at(1 * D + 2 * HR), home: NYK, away: SIX, state: "pre", network: "ESPN" },
  { league: BB, id: "98903", at: at(2 * D + 2 * HR), home: NYK, away: SIX, state: "pre", network: "TNT" },
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
  calendars[BB].days = Array.from({ length: 60 }, (_, i) => eastDay(now - 30 * D + i * D));
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: [], calendars, standings: STANDINGS });
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
      espn.events.length = 0;
      espn.events.push(...events);
      for (const [who, league, team] of follows) await (await call(who)).call("POST", "/api/sports/follow", { league, team, follow: true });
    };
    const pickem = async (who, team, eventId) => {
      const r = await (await call(who)).call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team, games: [eventId], game: "pickem", tell: false });
      if (r.status !== 200) console.log(`[sheet] Pick'em not started (${r.status} ${JSON.stringify(r.body).slice(0, 160)})`);
    };

    // A frame: a team's page, a tap on one of its schedule rows, then `go` inside the sheet.
    const shoot = async (name, { league = FB, team = E, game, go, user, pass, real } = {}) => {
      const b = await open({ user: user ?? alex, pass: pass ?? fixture.PASSWORD, width: W, height: H, headers: real ? {} : headers, motion: "reduce" });
      try {
        await b.page.goto(`${BASE}/league/${league}/team/${team}`, { waitUntil: "domcontentloaded" });
        await b.page.locator("[data-team-page]").waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(2500);
        const row = game ? b.page.locator(`[data-sched-row="${game}"]`) : b.page.locator("[data-sched-row][data-next]");
        await row.first().scrollIntoViewIfNeeded();
        await row.first().click();
        await b.page.locator("[data-game-view], [data-game-sheet]").first().waitFor({ timeout: 20000 });
        await b.page.waitForTimeout(2200);
        await go?.(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        const dialog = b.page.locator("[role=dialog]").last();
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await dialog.innerText().catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const yellow = await b.page.evaluate(() => [...document.querySelectorAll("[role=dialog] *")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20).length);
        console.log(`PASS ${name}  ${yellow} yellow in the sheet`);
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
      } finally {
        await b.close();
      }
    };
    const cowboysGiants = (name) => eventsFor(name).find((e) => e.home === G && e.away === C && e.state === "pre")?.id;

    if (run("pre") || run("types") || run("bigger")) {
      await setWorld("gameday", COUCH);
      const id = cowboysGiants("gameday");
      if (run("pre")) {
        await shoot("pre-none", { team: C, game: id });
      }
      if (!BEFORE && run("types"))
        await shoot("types", {
          team: C,
          game: id,
          go: async (pg) => {
            await pg.locator('[data-gallery-option="type-squares"]').click();
            await pg.waitForTimeout(700);
          },
        });
      if (!BEFORE && run("bigger"))
        await shoot("bigger", {
          team: C,
          game: id,
          go: async (pg) => {
            await pg.locator("[data-go-bigger]").scrollIntoViewIfNeeded();
            await pg.waitForTimeout(600);
          },
        });
      if (run("pre")) {
        await pickem("riley", C, id);
        await shoot("pre", { team: C, game: id });
      }
    }
    if (run("rivalry")) {
      await setWorld("midweek", COUCH);
      await shoot("rivalry", { team: E });
    }
    if (run("live")) {
      await setWorld("gameday", COUCH);
      const live = eventsFor("gameday").find((e) => e.state === "in" && e.home === J);
      // The couch's talk in its thread (the room's real route), so the sheet shows its link.
      for (const [who, text] of [["riley", "That catch on third down was unreal"], ["sam", "Refs are asleep"], ["jordan", "Jets defense is cooked"]])
        await (await call(who)).call("POST", `/api/sports/league/chat?league=${encodeURIComponent(FB)}&couch=${couch}`, { text, event: live.id, eventAt: live.at, eventName: "Eagles at Jets" });
      await shoot("live", { team: E, game: live.id });
      await setting(pool, alex, "hide_sports_scores", true);
      await shoot("live-hidden", { team: E, game: live.id });
      await pool.query("DELETE FROM chat_messages WHERE sports_league = $1", [FB]);
      await setting(pool, alex, "hide_sports_scores", false);
    }
    if (run("final")) {
      await setWorld("gameday", COUCH);
      const fin = eventsFor("gameday").filter((e) => e.state === "post" && (e.home === E || e.away === E)).pop()?.id;
      await shoot("final", { team: E, game: fin });
    }
    if (run("daily")) {
      await setWorld("daily", [["alex", BB, SIX], ["riley", BB, NYK]], daily());
      await shoot("daily", { league: BB, team: SIX, game: "98902" });
    }
    if (run("studio")) {
      await setWorld("gameday", COUCH);
      await setting(pool, alex, "theme", "studio");
      await shoot("studio", { team: C, game: cowboysGiants("gameday") });
      await setting(pool, alex, "theme", "night");
    }
    if (run("solo")) {
      await setWorld("solo", [], eventsFor("gameday"));
      await soloFx.up(pool);
      soloUp = true;
      const so = soloFx.username("alex");
      await (await signIn({ user: so, pass: soloFx.PASSWORD, headers })).call("POST", "/api/sports/follow", { league: FB, team: E, follow: true });
      const next = eventsFor("gameday").find((e) => e.state === "pre" && (e.home === E || e.away === E))?.id;
      await shoot("solo", { user: so, pass: soloFx.PASSWORD, game: next });
    }
    if (run("real")) {
      await setWorld("real", [], []);
      const me = await call("alex", { real: true });
      try {
        await me.call("POST", "/api/sports/follow", { league: "football/nfl", team: "21", follow: true });
        await shoot("real-nfl", { league: "football/nfl", team: "21", real: true });
      } finally {
        await me.call("POST", "/api/sports/follow", { league: "football/nfl", team: "21", follow: false }).catch(() => {});
        await me.call("POST", "/api/sports/follow", { league: "football/nfl", follow: false }).catch(() => {});
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
