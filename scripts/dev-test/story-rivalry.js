// Dev-only: a rivalry on the couch (docs/PLAN-sports-couch.md C1; the design: docs/design-round/rivalry-spec.md, -first-view.md,
// -shape.md), every moment of This week's rivalry card and Your call, for a design round's screenshot story and as a check of the
// rivalry's routes. On new-fixture.js's zt_nd couch and the stand-in ESPN (fake-espn.js by the x-gys-sports header; the real ESPN is
// never asked), the league story's world (league-story-world.js): Week 12 midweek, Eagles at Jets (alex vs Riley) and Cowboys at
// Giants (Sam vs Jordan) both to come, a season of finals behind them (the Eagles beat the Jets in Week 9).
//   spectator-fresh   Sam, nobody's picked: Pick a side (the first card; his own rivalry is the second)
//   fan               alex, no calls: Make your call, the yellow (fan.full: the page, both cards)
//   fan-sheet         alex's Your call: the Eagles chosen, a football margin of 3, "zt_nd_riley gets one notification"
//   fan-called        alex after sending Eagles by 6: "zt_nd_riley gets one notification", his margin his alone
//   challenged        Riley: "zt_nd_alex called Eagles. Your call?" (his margin hidden: "Eagles by ?")
//   challenged-sheet  Riley's sheet: the Jets chosen, Not this time
//   both              alex, both calls in: Change your call, no yellow
//   spectator         Sam after picking the Eagles (Jordan too): "With zt_nd_alex", the sides 3 to 1
//   second            Sam's page scrolled to his own rivalry ("Also this week"): his call outlined (one yellow a page)
//   game-page         the rivalry game's own page for Sam (the engine change: sides shown before the lock)
//   on                the Eagles on at the Jets: both calls in full, the score beside each team
//   over              final, Eagles 31-24: "zt_nd_alex called it: Eagles by 6, 1 off", the sides' checks, the record 2-0
//   over-fan          the same for alex ("You called it", "You lead zt_nd_riley 2–0 this season")
//   over-hidden       Sam hiding sports scores: the calls and sides, no score, result or record
//   over-hidden-shown after Show records
//   studio            alex's fan frame in the light theme
// With --before (the old code checked out, as the round shot it): fan, spectator-fresh and over only, each before any pick.
// Each frame: a .jpg at --width × --height, its words in a .txt, and words over words as OVERLAP lines (overlaps.json).
//
// Needs: the app (BASE) and the zt_nd couch (census-app.js --up, or new-fixture.js up; --up brings it up first). Every row it makes
// is a zt one (the stand-in leagues' shows, follows and games) and is removed after (check-sports-couch.js cleanup), unless --keep.
// One check at a time on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-rivalry.js --out=.ui-atlas/stories/rivalry/after
//          [--before] [--only=fan,over] [--width=390 --height=844] [--up] [--keep]
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
const { now, HR, TEAMS, eventsFor, COUCH, STANDINGS, E, C, J, FB } = require("./league-story-world");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-rivalry runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", `.ui-atlas/stories/rivalry/${has("before") ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const BEFORE = has("before");
const OVERLAPS = [];
let fails = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `  ${detail}` : ""}`);
  if (!ok) fails++;
};

async function setting(pool, user, col, v) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query(`UPDATE user_settings SET ${col} = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)`, [user, v]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  await world.cleanup(pool);
  if (has("up")) await fixture.up(pool);
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: [], calendars: world.calendarsAround(), standings: STANDINGS });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const user = (who) => fixture.username(who);
  try {
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run census-app.js --up, or this with --up)");
    const idOf = async (who) => (await pool.query('SELECT id FROM "user" WHERE username = $1', [user(who)])).rows[0].id;
    const call = (who) => signIn({ user: user(who), pass: fixture.PASSWORD, headers });
    for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
    espn.events.push(...eventsFor("midweek"));
    for (const [who, league, team] of COUCH) await (await call(who)).call("POST", "/api/sports/follow", { league, team, follow: true });
    const ej = espn.events.find((e) => e.id.endsWith("50") && e.home === J && e.away === E);
    if (!ej) throw new Error("the world has no Eagles at Jets this week");

    const pick = async (who, side, margin, rival) => {
      const r = await (await call(who)).call("POST", `/api/sports/rivalry?couch=${couch}`, { league: FB, event: ej.id, team: J, side, margin, name: "zt_nd_alex vs zt_nd_riley", rival });
      check(r.status === 200, `${who} picks ${side === E ? "the Eagles" : side === J ? "the Jets" : "nothing"}${margin ? ` by ${margin}` : ""}`, r.status === 200 ? "" : `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      return r.body.game;
    };

    const shoot = async (name, who, go, o = {}) => {
      if (ONLY && !ONLY.includes(name)) return null;
      const b = await open({ user: user(who), pass: fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + (o.path ?? `/league/${FB}/week`), { waitUntil: "domcontentloaded" });
        await b.page.locator(o.wait ?? "[data-this-week]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(4000);
        if (o.scroll) {
          // The Eagles at Jets card into view (once it's final, the rivalry still to come leads and its result is the second card).
          await b.page.locator(`[data-rivalry="${ej.id}"]`).evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 150));
          await b.page.waitForTimeout(500);
        }
        await go?.(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        if (o.full) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const info = await b.page.evaluate((id) => {
          const card = document.querySelector(`[data-rivalry="${id}"]`);
          const r = card?.getBoundingClientRect();
          return {
            wide: document.documentElement.scrollWidth,
            yellow: [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20 && e.getBoundingClientRect().top < innerHeight).length,
            card: card ? `${Math.round(r.top)}-${Math.round(r.bottom)} (${Math.round(r.height)} px)` : null,
            words: card?.innerText.replace(/\s+/g, " ").trim() ?? null,
            sheet: document.querySelector("[data-call-sheet]")?.innerText.replace(/\s+/g, " ").trim() ?? null,
          };
        }, ej.id);
        console.log(`SHOT ${name}  ${info.wide} px wide, ${info.yellow} yellow in view${info.card ? `, card ${info.card}` : ""}`);
        if (info.words && !o.sheet) console.log(`      card: ${info.words}`);
        if (info.sheet) console.log(`      sheet: ${info.sheet}`);
        return info;
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
        fails++;
        return null;
      } finally {
        await b.close();
      }
    };
    const tap = (sel) => async (pg) => {
      await pg.locator(sel).first().click();
      await pg.waitForTimeout(1200);
    };
    // The game: on, then over (the stand-in's schedules and the week read it; its cached reads cleared so the table reads it too).
    const setGame = async (state, score) => {
      ej.state = state;
      ej.at = new Date(now - 1.6 * HR).toISOString();
      if (score) ej.score = score;
      if (state === "in") ej.clock = { period: 3, display: "6:41", detail: "6:41 - 3rd", possession: E, down: "2nd & 7" };
      else delete ej.clock;
      await pool.query("UPDATE season_events SET starts_at = $2 WHERE league = $1 AND event_id = $3", [FB, ej.at, ej.id]);
      await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
    };

    if (BEFORE) {
      await shoot("fan", "alex", null, { full: true });
      await shoot("spectator-fresh", "sam");
      await setGame("post", [24, 31]);
      await shoot("over", "sam", null, { full: true });
      return;
    }

    const alexId = await idOf("alex");
    const rileyId = await idOf("riley");
    await shoot("spectator-fresh", "sam");
    const f = await shoot("fan", "alex", null, { full: true });
    if (f) check(f.yellow === 1, "one yellow on alex's page (Make your call)", `${f.yellow}`);
    await setting(pool, user("alex"), "theme", "studio");
    await shoot("studio", "alex");
    await setting(pool, user("alex"), "theme", "night");
    await shoot("fan-sheet", "alex", tap("[data-rivalry-call-open]"), { sheet: true });
    // alex's call goes from the sheet itself (the real button), then the card says who's told.
    await shoot("fan-called", "alex", async (pg) => {
      await pg.locator("[data-rivalry-call-open]").first().click();
      await pg.waitForTimeout(900);
      for (let i = 0; i < 3; i++) await pg.locator('button[aria-label="One more"]').click();
      await pg.locator("[data-call-send]").click();
      await pg.waitForTimeout(2500);
    });
    let g = (await (await call("alex")).call("GET", `/api/sports/rivalry?couch=${couch}&league=${encodeURIComponent(FB)}`)).body.games?.find((x) => x.event === ej.id);
    if (!ONLY) {
      check(!!g, "the rivalry game was started by the call");
      const a = g?.picks.find((p) => p.userId === alexId);
      check(a?.side === E && a?.margin === 6, "alex's call: Eagles by 6", JSON.stringify(a));
      await new Promise((r) => setTimeout(r, 1500));
      const pushes = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE '%made a call on%'", [rileyId]);
      check(pushes.rows[0].n === 1, "Riley was told, once", `${pushes.rows[0].n}`);
    } else if (!g) await pick("alex", E, 6, rileyId);
    const asRiley = (await (await call("riley")).call("GET", `/api/sports/rivalry?couch=${couch}&league=${encodeURIComponent(FB)}`)).body.games?.find((x) => x.event === ej.id);
    check(asRiley?.picks.find((p) => p.userId === alexId)?.margin === null, "alex's margin is hidden from Riley before kickoff");
    await shoot("challenged", "riley");
    await shoot("challenged-sheet", "riley", tap("[data-rivalry-call-open]"), { sheet: true });
    await pick("riley", J, 3, alexId);
    await shoot("both", "alex");
    await pick("sam", E);
    await pick("jordan", E);
    const s = await shoot("spectator", "sam");
    if (s) check(/With zt_nd_alex/.test(s.words ?? ""), "Sam's side says whose it is");
    await shoot("second", "sam", async (pg) => {
      await pg.locator("[data-rivalry]").nth(1).evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 150));
      await pg.waitForTimeout(600);
    });
    g = (await (await call("sam")).call("GET", `/api/sports/rivalry?couch=${couch}&league=${encodeURIComponent(FB)}`)).body.games?.find((x) => x.event === ej.id);
    if (g) {
      const gp = await shoot("game-page", "sam", null, { path: `/show/${g.seasonId}/game/${g.leagueId}`, wait: "[data-game-page]" });
      if (gp) check(true, "the rivalry game's page opens");
    }
    // A pick after kickoff is refused.
    await setGame("in", [10, 14]);
    const late = await (await call("sam")).call("POST", `/api/sports/rivalry?couch=${couch}`, { league: FB, event: ej.id, team: J, side: J });
    check(late.status === 409 || late.status === 404, "a pick after kickoff is refused", `${late.status}`);
    await shoot("on", "sam");
    await setGame("post", [24, 31]);
    const o = await shoot("over", "sam", null, { scroll: true, full: true });
    if (o) check(/called it/i.test(o.words ?? "") && /2–0/.test(o.words ?? ""), "the result line and the record");
    await shoot("over-fan", "alex", null, { scroll: true });
    await setting(pool, user("sam"), "hide_sports_scores", true);
    const hdn = await shoot("over-hidden", "sam", null, { scroll: true });
    if (hdn) check(!/called it|31|24|2–0/i.test(hdn.words ?? ""), "hidden: no result, score or record");
    await shoot("over-hidden-shown", "sam", async (pg) => {
      await pg.locator("[data-show-records]").first().click();
      await pg.waitForTimeout(1500);
      await pg.locator(`[data-rivalry="${ej.id}"]`).evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 150));
      await pg.waitForTimeout(500);
    });
    await setting(pool, user("sam"), "hide_sports_scores", false);
  } catch (e) {
    console.error(e);
    fails++;
  } finally {
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 2));
    if (!has("keep")) await world.cleanup(pool);
    await espn.close?.();
    await pool.end();
    await appPool.end?.().catch?.(() => {});
    console.log(fails ? `${fails} failed` : "all passed");
    process.exit(fails ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
