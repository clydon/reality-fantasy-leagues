// Dev-only: the hub's sports, every state of the scores strip under the guide bar (docs/PLAN-sports-couch.md A1; the shape:
// docs/design-round/hub-scorebug-shape.md), for a design round's screenshot story. On new-fixture.js's zt_nd couch and a stand-in
// ESPN (fake-espn.js, by the x-gys-sports header: the real ESPN is never asked), check-sports-couch.js's ZT leagues with two more
// football teams. As alex (solo-fixture.js's zt_so_alex for the solo hub) at --width, each scenario's frames under --out (a .jpg, the page's words in a
// .txt, and a .strip.png of the strip alone at twice the size where it's drawn):
//   many          the Eagles on now at the Jets (3rd quarter, the Eagles' ball, 2nd & 7; Riley follows the Jets), the Sixers'
//                 final from last night, alex's Pick'em on Cowboys at Giants later today (a pick due) and the Lions' game tonight:
//                 the hub (many-hub, many-hub.full), the strip swiped (many-swiped), the tile's sheet (many-all), the final's ask
//                 (many-ask), its score shown (many-shown), and the guide's Sports (many-guide-sports)
//   pick          the same, with alex's pick in (the Giants): the chyron underline, no due dot
//   hidden        the same with Hide sports scores on: "Started", no numbers, Show; and its ask
//   recording     the live game watched as if live: Watching, and its ask
//   bye           one game: the Eagles on a bye, their next game eight days on (the week after is read)
//   none          no teams, no games: no strip
//   basketball    a basketball game on (Q4 2:31, three digits): the status column outside football
//   solo          the solo hub (solo-fixture.js's zt_so_alex, on no couch: up for the run, down after), following the Eagles and
//                 the Sixers
//   studio        many and hidden in the light theme (Studio): studio-hub, studio-hidden
//   one           one league (A2): alex follows only the Eagles, every game of the couch's teams still to come today, so the
//                 card's line can say who leads the couch's teams by record
// The league cards in Your shows (A2: hub/league-cards.tsx): each world also shoots <world>-cards (scrolled to Your shows) and
// each card alone at twice the size (<world>-cards.card-N.png); many also the card's tap (many-league, the league's sheet). In
// many alex also follows the ZT Yankees (a stand-in baseball league in its off-season: one line), and Riley and Sam join the
// Pick'em. The stand-in's calendars (check-sports-couch.js calendarsAround) give each league its week.
// --before: the same worlds on a server running the code before the change (A1's: the old Scoreboard in Your shows and On TV's
// sports cards; A2's: A1's tree, no league cards): the hub and cards frames only. Each frame prints the strip's height, the page's width and every
// bug's words (its screen-reader sentence); words that sit on other words print as OVERLAP lines (overlaps.js), kept in
// overlaps.json.
//
// Needs: the app (BASE, default :3000) and the zt_nd couch up (census-app.js --up, or new-fixture.js up; --up brings it up first:
// it restarts the base couch, never beside another check on it). Removes every row it made after (check-sports-couch.js cleanup;
// the solo fixture taken down), unless --keep.
// Run:   node scripts/dev-test/story-hub-sports.js --out=.ui-atlas/stories/<design>/after [--only=many,hidden] [--before]
//          [--width=390 --height=844] [--up] [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-hub-sports runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/sports-hub"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const BEFORE = has("before");
const MB = world.MB;
const ONLY = opt("only", "") ? opt("only").split(",") : null;

const FB = world.FB;
const BB = world.BB;
const HR = 3600_000;
const D = 24 * HR;
const now = Date.now();
const at = (ms) => new Date(Math.round((now + ms) / 60_000) * 60_000).toISOString();
// Later today, wherever the clock is: never past 10:30 PM (a game "today" that slipped into tomorrow would be another state).
const endOfDay = new Date(new Date(now).setHours(22, 30, 0, 0)).getTime() - now;
const today = (ms) => at(Math.max(10 * 60_000, Math.min(ms, endOfDay)));
const TEAMS = [
  ...world.TEAMS,
  { id: "9305", name: "ZT Bears", short: "Bears", location: "ZT Chicago", abbreviation: "ZCHI", league: FB, color: "0b162a" },
  { id: "9306", name: "ZT Lions", short: "Lions", location: "ZT Detroit", abbreviation: "ZDET", league: FB, color: "0076b6" },
];

/** A scenario's games, with ids of its own (the live route keeps a game's answer 10 s: a new world gets new games). */
function eventsFor(name) {
  const n = { many: 1, pick: 2, hidden: 3, recording: 4, bye: 5, none: 6, basketball: 7, solo: 8, studio: 9, one: 10 }[name];
  const id = (k) => `95${n}${k}`;
  if (name === "bye") return [{ league: FB, id: id(1), at: at(8 * D + 2 * HR), home: "9302", away: "9301", state: "pre", records: ["6-4", "7-3"], network: "CBS", odds: { details: "ZDAL -2.5", overUnder: 44.5, spread: -2.5 } }];
  if (name === "none") return [];
  // One league, nothing on yet: every couch team's game later today, each with its record (the card's record line).
  if (name === "one")
    return [
      { league: FB, id: id(1), at: today(2 * HR), home: "9304", away: "9301", state: "pre", records: ["5-5", "7-3"], network: "FOX", odds: { details: "ZPHI -2.5", overUnder: 44.5, spread: -2.5 } },
      { league: FB, id: id(3), at: today(4 * HR), home: "9303", away: "9302", state: "pre", records: ["5-3-1", "6-4"], network: "CBS" },
    ];
  if (name === "basketball")
    return [{ league: BB, id: id(1), at: at(-2.2 * HR), home: "9401", away: "9402", state: "in", score: [101, 98], records: ["11-6", "9-8"], network: "ESPN", clock: { period: 4, display: "2:31", detail: "2:31 - 4th" } }];
  return [
    { league: FB, id: id(1), at: at(-1.6 * HR), home: "9304", away: "9301", state: "in", score: [10, 14], records: ["5-5", "7-3"], network: "FOX", clock: { period: 3, display: "6:41", detail: "6:41 - 3rd", possession: "9301", down: "2nd & 7" } },
    { league: BB, id: id(2), at: at(-17 * HR), home: "9401", away: "9402", state: "post", score: [112, 104], records: ["11-6", "9-8"], network: "ESPN" },
    { league: FB, id: id(3), at: today(1.5 * HR), home: "9303", away: "9302", state: "pre", records: ["5-3-1", "6-4"], network: "CBS", odds: { details: "ZNYG -3", overUnder: 41.5, spread: -3 } },
    { league: FB, id: id(4), at: today(4.5 * HR), home: "9306", away: "9305", state: "pre", records: ["8-2", "4-6"], network: "NBC", odds: { details: "ZDET -6.5", overUnder: 47.5, spread: -6.5 } },
    { league: FB, id: id(5), at: at(7 * D), home: "9301", away: "9303", state: "pre" },
    { league: BB, id: id(6), at: at(2 * D), home: "9402", away: "9401", state: "pre" },
  ];
}

// Alex's teams in each world; the couch's others the same everywhere (Riley the Jets, Sam the Cowboys, Jordan the Giants).
const ALEX = { many: [[FB, "9301"], [BB, "9401"], [FB, "9306"], [MB, "9501"]], bye: [[FB, "9301"]], basketball: [[BB, "9401"]], one: [[FB, "9301"]] };
const OTHERS = [["riley", FB, "9304"], ["sam", FB, "9302"], ["jordan", FB, "9303"]];
const alexIn = (w) => (ALEX[w] ?? ALEX.many).map(([l, t]) => ["alex", l, t]);

async function theme(pool, user, t) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query('UPDATE user_settings SET theme = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)', [user, t]);
}

async function hideScores(pool, user, on) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query('UPDATE user_settings SET hide_sports_scores = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)', [user, on]);
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
    for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run census-app.js --up, or this with --up)");
    const call = (who) => signIn({ user: fixture.username(who), pass: fixture.PASSWORD, headers });
    const me = await call("alex");

    /** A fresh world: its games, its follows, nothing watched as if live, scores shown, no games started, the stand-in's cache cleared. */
    const setWorld = async (name, follows) => {
      await world.cleanup(pool);
      for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
      espn.events.length = 0;
      espn.events.push(...eventsFor(name));
      for (const [who, league, team] of follows) await (await call(who)).call("POST", "/api/sports/follow", { league, team, follow: true });
    };
    const pickem = async (eventId, joiners = []) => {
      const p = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team: "9302", games: [eventId], game: "pickem", tell: false });
      if (p.status !== 200) console.log(`[sports] Pick'em not started (${p.status} ${JSON.stringify(p.body).slice(0, 200)})`);
      // Others in it too (the league card's "3 playing").
      const code = p.body.leagueId ? (await pool.query("SELECT join_code FROM leagues WHERE id = $1", [p.body.leagueId])).rows[0]?.join_code : null;
      for (const who of joiners) {
        const j = code ? await (await call(who)).call("POST", "/api/leagues/join", { code }) : { status: 0 };
        if (j.status !== 200) console.log(`[sports] ${who} didn't join the Pick'em (${j.status})`);
      }
      return p.body;
    };

    const shoot = async (name, go, o = {}) => {
      const b = await open({ user: o.user ?? alex, pass: o.pass ?? fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await b.page.locator("[data-hub]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(3500);
        await go(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        if (o.full) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        const strip = b.page.locator("[data-scores-strip]").first();
        if (!o.sheet && (await strip.count()) && (await strip.isVisible())) await strip.screenshot({ path: path.join(OUT, `${name}.strip.png`) });
        // The league cards alone (A2), each at twice the size.
        if (o.cards) {
          const cards = b.page.locator("[data-your-shows] [data-league-card]");
          for (let i = 0; i < (await cards.count()); i++) await cards.nth(i).screenshot({ path: path.join(OUT, `${name}.card-${i + 1}.png`) });
        }
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const info = await b.page.evaluate(() => {
          const s = document.querySelector("[data-scores-strip]");
          const tv = document.querySelector("[data-on-tv]");
          const bugs = [...document.querySelectorAll("[data-scores-strip] [data-bug]")].map((x) => `${x.getAttribute("data-bucket")}: ${x.getAttribute("aria-label")}`);
          // Your shows in order: each band's season, each league card's league with its height and words (A2).
          const shelf = [...document.querySelectorAll("[data-your-shows] [data-band], [data-your-shows] [data-league-card]")].map((x) =>
            x.hasAttribute("data-league-card") ? `card ${x.getAttribute("data-league-card")} ${Math.round(x.getBoundingClientRect().height)} px: ${x.getAttribute("aria-label")}` : `band ${x.getAttribute("data-band")}`
          );
          return {
            strip: s ? Math.round(s.getBoundingClientRect().height) : null,
            tv: tv ? Math.round(tv.getBoundingClientRect().height) : null,
            wide: document.documentElement.scrollWidth,
            scoreboard: !!document.querySelector("[data-scoreboard]"),
            tvSports: document.querySelectorAll('[data-on-tv] [data-guide-card^="sport:"]').length,
            bugs,
            shelf,
          };
        });
        console.log(`PASS ${name}  strip ${info.strip ?? "none"} px (On TV ${info.tv} px), page ${info.wide} px wide${info.scoreboard ? ", old Scoreboard" : ""}${info.tvSports ? `, ${info.tvSports} sports cards in On TV` : ""}`);
        for (const x of info.bugs) console.log(`      ${x}`);
        if (o.cards) for (const x of info.shelf) console.log(`      ${x}`);
        return info;
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
        return null;
      } finally {
        await b.close();
      }
    };
    const toStrip = async (pg) => {
      const s = pg.locator("[data-on-tv]").first();
      if (await s.count()) await s.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 260)));
      await pg.waitForTimeout(600);
    };
    const reel = (pg) => pg.locator("[data-scores-reel]").first();
    // Your shows at the top of the screen (under the bar), for the league cards among the bands.
    const toShows = async (pg) => {
      const s = pg.locator("[data-your-shows]").first();
      if (await s.count()) await s.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 64)));
      await pg.waitForTimeout(600);
    };
    const cardsOf = (w, o = {}) => shoot(`${w}-cards`, toShows, { cards: true, ...o });
    const run = (n) => !ONLY || ONLY.includes(n);

    if (run("many")) {
      await setWorld("many", [...alexIn("many"), ...OTHERS]);
      await pickem(eventsFor("many")[2].id, ["riley", "sam"]);
      await shoot("many-hub", toStrip, { full: true });
      await cardsOf("many");
      if (!BEFORE)
        await shoot(
          "many-league",
          async (pg) => {
            await toShows(pg);
            await pg.locator(`[data-league-card="${FB}"]`).click();
            await pg.locator("[data-league-view]").waitFor({ timeout: 10000 });
            await pg.waitForTimeout(900);
          },
          { sheet: true }
        );
      if (!BEFORE) {
        await shoot("many-swiped", async (pg) => {
          await toStrip(pg);
          await reel(pg).evaluate((el) => (el.scrollLeft = el.scrollWidth));
          await pg.waitForTimeout(700);
        });
        await shoot(
          "many-all",
          async (pg) => {
            await pg.locator("[data-scores-open]").click();
            await pg.locator("[data-scores-all]").waitFor({ timeout: 10000 });
            await pg.waitForTimeout(800);
          },
          { sheet: true }
        );
        await shoot(
          "many-ask",
          async (pg) => {
            await toStrip(pg);
            await reel(pg).locator('[data-bucket="final"]').first().click();
            await pg.locator("[data-score-ask]").waitFor({ timeout: 10000 });
            await pg.waitForTimeout(700);
          },
          { sheet: true }
        );
        await shoot("many-shown", async (pg) => {
          await toStrip(pg);
          await reel(pg).locator('[data-bucket="final"]').first().click();
          await pg.locator("[data-show-fresh]").click();
          await pg.waitForTimeout(1200);
        });
      }
      await shoot(
        "many-guide-sports",
        async (pg) => {
          await pg.locator("[data-on-tv-open]").click();
          await pg.locator("[data-guide-page]").waitFor({ timeout: 15000 });
          await pg.locator('[data-guide-tv-choice="sports"]').last().click();
          await pg.locator("[data-sports-day], [data-sports-guide]").first().waitFor({ timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(1500);
          // The guide's switch is kept per phone: back to Couch for the next run.
          await pg.screenshot({ path: path.join(OUT, "many-guide-sports.jpg"), type: "jpeg", quality: 84 });
          await pg.locator('[data-guide-tv-choice="couch"]').last().click();
        },
        { sheet: true }
      );
    }
    if (run("pick") && !BEFORE) {
      await setWorld("pick", [...alexIn("many"), ...OTHERS]);
      const ev = eventsFor("pick")[2].id;
      const started = await pickem(ev);
      if (started.leagueId) {
        const q = await me.call("GET", `/api/seasons/${started.seasonId}/answers?league=${started.leagueId}`);
        const win = q.body.questions?.find((x) => /win/i.test(x.ask ?? x.question?.ask ?? ""));
        const side = win?.faces?.find((f) => /Giants/.test(f.name))?.id;
        const a = win && side ? await me.call("POST", `/api/seasons/${started.seasonId}/answers?league=${started.leagueId}`, { answers: { [win.id]: side } }) : { status: 0 };
        console.log(a.status === 200 ? "[sports] alex picks the Giants" : `[sports] the pick didn't go in (${a.status})`);
      }
      await shoot("pick-hub", async (pg) => {
        await toStrip(pg);
        await pg.locator(`[data-scores-reel] [data-bug="${ev}"]`).evaluate((e) => e.parentElement.scrollBy({ left: e.getBoundingClientRect().left - e.parentElement.getBoundingClientRect().left - 14 }));
        await pg.waitForTimeout(700);
      });
    }
    if (run("hidden")) {
      await setWorld("hidden", [...alexIn("many"), ...OTHERS]);
      await pickem(eventsFor("hidden")[2].id);
      await hideScores(pool, alex, true);
      await shoot("hidden-hub", toStrip);
      await cardsOf("hidden");
      if (!BEFORE)
        await shoot(
          "hidden-ask",
          async (pg) => {
            await toStrip(pg);
            await reel(pg).locator('[data-bucket="started"]').first().click();
            await pg.locator("[data-score-ask]").waitFor({ timeout: 10000 });
            await pg.waitForTimeout(700);
          },
          { sheet: true }
        );
      await hideScores(pool, alex, false);
    }
    if (run("recording") && !BEFORE) {
      await setWorld("recording", [...alexIn("many"), ...OTHERS]);
      const live = eventsFor("recording")[0];
      const r = await me.call("POST", "/api/sports/recordings", { game: live.id, league: live.league, on: true });
      if (r.status !== 200) console.log(`[sports] watching as if live not kept (${r.status})`);
      await shoot("recording-hub", toStrip);
      await shoot(
        "recording-ask",
        async (pg) => {
          await toStrip(pg);
          await pg.locator(`[data-bug="${live.id}"]`).click();
          await pg.locator("[data-recording-done]").waitFor({ timeout: 10000 });
          await pg.waitForTimeout(700);
        },
        { sheet: true }
      );
    }
    if (run("bye")) {
      await setWorld("bye", [...alexIn("bye"), ...OTHERS]);
      await shoot("bye-hub", toStrip);
      await cardsOf("bye");
    }
    if (run("none")) {
      await setWorld("none", OTHERS);
      await shoot("none-hub", toStrip);
      await cardsOf("none");
    }
    if (run("one")) {
      await setWorld("one", [...alexIn("one"), ...OTHERS]);
      await cardsOf("one");
    }
    if (run("basketball") && !BEFORE) {
      await setWorld("basketball", alexIn("basketball"));
      await shoot("basketball-hub", toStrip);
    }
    if (run("studio") && !BEFORE) {
      await setWorld("studio", [...alexIn("many"), ...OTHERS]);
      await pickem(eventsFor("studio")[2].id);
      await theme(pool, alex, "studio");
      await shoot("studio-hub", toStrip);
      await cardsOf("studio");
      await hideScores(pool, alex, true);
      await shoot("studio-hidden", toStrip);
      await hideScores(pool, alex, false);
      await theme(pool, alex, "night");
    }
    if (run("solo")) {
      // Someone truly on no couch: solo-fixture.js's zt_so_alex (the zt_nd people play the couch's games, and the home read puts
      // a game's player back on its couch, so taking casey off it never gave the solo hub), up for this world and down after.
      await setWorld("solo", []);
      await soloFx.up(pool);
      soloUp = true;
      const so = soloFx.username("alex");
      const soMe = await signIn({ user: so, pass: soloFx.PASSWORD, headers });
      for (const [league, team] of [[FB, "9301"], [BB, "9401"]]) await soMe.call("POST", "/api/sports/follow", { league, team, follow: true });
      await shoot("solo-hub", toStrip, { user: so, pass: soloFx.PASSWORD, full: true });
      await cardsOf("solo", { user: so, pass: soloFx.PASSWORD });
    }
  } finally {
    if (soloUp) await soloFx.down(pool).catch((e) => console.log(`solo fixture not taken down: ${e.message}`));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 1));
    await hideScores(pool, alex, false).catch(() => {});
    await theme(pool, alex, "night").catch(() => {});
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
