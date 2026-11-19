// Dev-only test bank: Start a game as it is, in each situation, for the wizard redo's screenshot story (docs/PLAN-start-a-game-redo.md,
// Round 1's "before"; reusable for Round 2's before/after). Real renders at a phone's size on the dev server, as zt_nd_alex on
// new-fixture.js's couch (ZT Survivor 51, results through Episode 5, Episode 6 three days out), with hub-fixture.js's finished seasons
// and crew-fixture.js's crew show. Every situation is one frame (its first view, <id>.jpg) plus the whole sheet when it scrolls
// (<id>.full.jpg) and its words (<id>.txt); a situation that can't be reached prints SKIP and the run goes on.
//   hub-pick      the hub's Start a game (the wizard on the show that airs next; Pick the show when there's none)
//   wiz-tonight   a show mid-season, its Games tab's Start a game: the wizard on Tonight (its default mid-season)
//   wiz-season    the same, The season tapped
//   wiz-step      a step's screen (Each episode: its kinds, count and twists)
//   wiz-scores    What scores
//   wiz-every     Every game
//   wiz-custom    Custom, its episodes picked like dates
//   wiz-describe  Describe a new game (the field, before anything's typed)
//   aired         a season that's aired (ZT Survivor 50): the wizard at your own pace
//   again         Run it back (ZT Survivor 50's Outlast on ZT Survivor 52): the older list again
//   story         a story show (crew-fixture.js's ZT Yacht, set up as a game for the run): the wizard
//   team          a sport, a team found by the hub's search (--team=<words>, default "76ers"; the REAL ESPN through the dev server, as
//                 a person's search reads it; skipped with --no-team or when it can't be reached): the team's Start a game
//
//   npm run dev   (the app on :3000; BASE= for another)
//   node scripts/dev-test/story-start-wizard.js [--out=.ui-atlas/stories/wizard-r1/before] [--only=<regex on the id>]
//        [--width=390 --height=844] [--keep] [--team=76ers | --no-team]
//
// Brings new-fixture.js, hub-fixture.js and crew-fixture.js up and takes them down (--keep leaves them; ZT Survivor 52, added for Run
// it back, goes with new-fixture's down as a season of its zt show). zt rows only; refuses a non-local database. Shares new-fixture's
// zt_nd_ couch with other checks: never run two at once. Also writes index.json (each frame and what was judged) and overlaps.json.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./new-fixture");
const hubFixture = require("./hub-fixture");
const crewFixture = require("./crew-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/wizard-r1/before"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const TEAM = has("no-team") ? null : opt("team", "76ers");
const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-start-wizard runs against a local database only");
fs.mkdirSync(OUT, { recursive: true });

const wanted = (id) => !ONLY || new RegExp(ONLY).test(id);
const wait = (p, ms) => p.waitForTimeout(ms);
const top = (p) => p.locator('[role="dialog"]').last();
const OVERLAPS = [];
const INDEX = [];

/** One frame: the first view, its words and overlaps, then the top sheet laid out whole when it scrolls (story-person-sheet.js's way). */
async function shoot(p, id, note) {
  const base = path.join(OUT, id);
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await wait(p, 600);
  const face = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded"); }).catch(() => false);
  if (!face) throw new Error("Archivo never loaded (is the dev server mid-recompile?)");
  const hits = await overlapsIn(p, H).catch(() => []);
  OVERLAPS.push({ frame: id, hits });
  for (const h of hits) console.log(`OVERLAP ${id}: "${h[0]}" over "${h[1]}"`);
  await p.screenshot({ path: base + ".jpg", type: "jpeg", quality: 84 });
  const words = (await top(p).count()) ? await top(p).innerText() : await p.evaluate(() => document.body.innerText);
  fs.writeFileSync(base + ".txt", words);
  // The first phone view's measures: how many controls a thumb could press, and how far the sheet scrolls.
  const measures = await p.evaluate((h) => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1) || document.body;
    const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < h && r.bottom > 0; };
    const controls = [...d.querySelectorAll("button, a[href], input, textarea, [role=radio], [role=switch], [role=tab]")].filter(visible).length;
    const sc = [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4);
    return { controls, screens: sc ? Math.round((sc.scrollHeight / sc.clientHeight) * 10) / 10 : 1 };
  }, H);
  const tall = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const sc = d && [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4);
    return d && sc ? d.getBoundingClientRect().height + (sc.scrollHeight - sc.clientHeight) : 0;
  });
  if (tall) {
    await p.setViewportSize({ width: W, height: Math.ceil(tall) + 80 });
    const style = await p.addStyleTag({ content: '[role="dialog"]{max-height:none!important} [role="dialog"] .overflow-y-auto{overflow:visible!important}' });
    await wait(p, 600);
    const box = await top(p).boundingBox();
    if (box) await p.screenshot({ path: base + ".full.jpg", type: "jpeg", quality: 80, clip: { x: 0, y: Math.max(0, box.y), width: W, height: Math.ceil(box.height) } });
    await style.evaluate((e) => e.remove());
    await p.setViewportSize({ width: W, height: H });
    await wait(p, 400);
  }
  INDEX.push({ id, note, ...measures, full: !!tall });
  console.log(`SHOT ${id}  (${measures.controls} controls in the first view, ${measures.screens} screens tall)${tall ? " + whole sheet" : ""}`);
}

/** Run one situation: skipped (with why) when it isn't wanted or can't be reached, so the rest still run. */
async function situation(id, note, fn) {
  if (!wanted(id)) return;
  try {
    await fn();
  } catch (e) {
    console.log(`SKIP ${id}: ${String((e && e.message) || e).split("\n")[0].slice(0, 200)}`);
    INDEX.push({ id, note, skipped: String((e && e.message) || e).split("\n")[0].slice(0, 200) });
  }
}

async function main() {
  const pool = new Pool({ connectionString: DB });
  let close = null;
  try {
    const fx = await fixture.up(pool);
    const hub = await hubFixture.up(pool, fx);
    const crew = await crewFixture.up(pool);
    // The crew show as a game (Make it a game's set_up_at), so its Start a game is the wizard, not Make it a game.
    await pool.query("UPDATE shows SET set_up_at = now() WHERE id = (SELECT show_id FROM show_seasons WHERE id = $1)", [crew.season]);
    // Run it back needs the show's next season: ZT Survivor 52, upcoming (check-new-start-game.js's own).
    const show = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [fx.seasonId])).rows[0].show_id;
    await pool.query("DELETE FROM show_seasons WHERE show_id = $1 AND season_number = 52", [show]);
    await pool.query(
      `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
       VALUES ($1, 52, 'ZT Survivor 52', 'upcoming', current_date + 60, '20:00', 'America/New_York', 90, 13)`,
      [show]
    );

    const b = await open({ user: "zt_nd_alex", pass: fixture.PASSWORD, width: W, height: H, motion: "off" });
    close = b.close;
    const p = b.page;
    const games = async (seasonId) => {
      await p.goto(`${BASE}/show/${seasonId}/games`, { waitUntil: "domcontentloaded" });
      await wait(p, 1500);
    };
    const wizard = async () => {
      await games(fx.seasonId);
      await p.locator("[data-start-row], [data-play-start]").first().click();
      await p.locator("[data-start-screen=home]").waitFor({ timeout: 30000 });
      await wait(p, 900);
    };
    const back = async () => {
      await p.locator("[data-sheet-back]").last().click().catch(() => {});
      await wait(p, 700);
    };

    await situation("hub-pick", "The hub's Start a game: the show first, then the wizard", async () => {
      await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await wait(p, 2000);
      const start = p.locator("[data-foot-start], button:has-text('Start a game')").first();
      await start.scrollIntoViewIfNeeded();
      await start.click();
      await p.locator("[data-start-pick], [data-start-screen=home]").first().waitFor({ timeout: 20000 });
      await shoot(p, "hub-pick", "From the hub: Start a game opens the wizard on the show that airs next (here the crew show, Monday)");
    });

    await situation("wiz-tonight", "Mid-season (Episode 6 next): the wizard opens on Tonight", async () => {
      await wizard();
      await shoot(p, "wiz-tonight", "The wizard mid-season: When it runs (Tonight by default), Start from's rail, the white game card, the couch, Start it");
    });

    await situation("wiz-season", "The season tapped: the rail and the card follow", async () => {
      if (!(await p.locator("[data-start-screen=home]").count())) await wizard();
      await p.locator("[data-start-mode=season]").click();
      await wait(p, 900);
      await shoot(p, "wiz-season", "The season tapped: the rail and the game change under it (picks don't only flow down)");
    });

    await situation("wiz-step", "A step's screen", async () => {
      if (!(await p.locator("[data-start-screen=home]").count())) await wizard();
      await p.locator("[data-start-step=each]").first().click();
      await p.locator("[data-start-stepscreen=each]").waitFor({ timeout: 10000 });
      await wait(p, 700);
      await shoot(p, "wiz-step", "A step of the game card (Each episode): the kinds, the count, the twists for that step");
      await back();
    });

    await situation("wiz-scores", "What scores", async () => {
      if (!(await p.locator("[data-start-screen=home]").count())) await wizard();
      await p.locator("[data-start-cardrow=scores]").first().click();
      await p.locator("[data-start-scores]").waitFor({ timeout: 10000 });
      await wait(p, 700);
      await shoot(p, "wiz-scores", "What scores: the season's moments with their points, on and off");
      await back();
    });

    await situation("wiz-every", "Every game", async () => {
      if (!(await p.locator("[data-start-screen=home]").count())) await wizard();
      await p.locator("[data-start-all]").first().click();
      await p.locator("[data-start-every]").first().waitFor({ timeout: 10000 });
      await wait(p, 700);
      await shoot(p, "wiz-every", "Every game: the kinds that fit this stretch, with made-for games");
      await back();
    });

    await situation("wiz-custom", "Custom: episodes picked like dates", async () => {
      if (!(await p.locator("[data-start-screen=home]").count())) await wizard();
      await p.locator("[data-start-mode=custom]").click();
      await wait(p, 500);
      await p.locator('[data-start-cview="episodes"]').click().catch(() => {});
      await wait(p, 700);
      await shoot(p, "wiz-custom", "Custom: stages or episodes, tapped like dates");
    });

    await situation("wiz-describe", "Describe a new game", async () => {
      await wizard();
      await p.locator("[data-start-describe]").first().click();
      await p.locator("[data-start-words]").waitFor({ timeout: 10000 });
      await wait(p, 700);
      await shoot(p, "wiz-describe", "Describe a new game: the field and examples (our AI, about 40 seconds)");
    });

    await situation("aired", "A season that's aired: Start a game at your own pace, the older list", async () => {
      await games(hub.seasons.s50);
      await p.locator('[data-start-row="pace"], [data-start-row], [data-play-start]').first().click();
      await p.locator("[data-start-sheet], [data-start-screen=home]").first().waitFor({ timeout: 20000 });
      await wait(p, 900);
      await shoot(p, "aired", "A season that's aired (ZT Survivor 50): the wizard at your own pace (from Episode 1), with Computer players");
    });

    await situation("again", "Run it back: the older list", async () => {
      await games(hub.seasons.s50);
      await p.locator('[data-start-row="again"], [data-start-row="again-span"]').first().click();
      await p.locator("[data-start-sheet], [data-start-screen=home]").first().waitFor({ timeout: 20000 });
      await wait(p, 900);
      await shoot(p, "again", "Run it back (ZT Survivor 50's game on ZT Survivor 52): the older list again");
    });

    await situation("story", "A story show: the wizard on a crew show", async () => {
      await games(crew.season);
      await p.locator("[data-start-row], [data-play-start]").first().click();
      await p.locator("[data-start-screen=home], [data-start-sheet], [data-start-nothing]").first().waitFor({ timeout: 30000 });
      await wait(p, 900);
      await shoot(p, "story", "A story show (ZT Yacht, a crew made from Below Deck's rulebook): the same wizard, a competition's words");
    });

    if (TEAM)
      await situation("team", "A sport: a team found by search, its Start a game", async () => {
        await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        await wait(p, 1500);
        // Add a show's search finds teams too (U0: one search, grouped Shows, Teams, Leagues).
        const add = p.locator("[data-add-show-poster]").first();
        await add.scrollIntoViewIfNeeded();
        await add.click();
        const box = p.locator('input[aria-label="Search or add a show"]').first();
        await box.waitFor({ timeout: 15000 });
        await box.fill(TEAM);
        const row = p.locator("[data-sports-results] button").filter({ hasText: new RegExp(TEAM, "i") }).first();
        await row.waitFor({ timeout: 30000 });
        await row.click();
        await p.locator("[data-team-view]").last().waitFor({ timeout: 25000 });
        await wait(p, 1500);
        const start = top(p).locator('[data-more="start"]').first();
        await start.click();
        await wait(p, 2500);
        await shoot(p, "team", `A sport (the ${TEAM}, the real ESPN): Start a game on a team, B in a sport's words`);
      });
  } finally {
    if (close) await close().catch(() => {});
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(INDEX, null, 1));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 1));
    if (!has("keep")) {
      await crewFixture.down(pool).catch((e) => console.log("crew down:", e.message));
      await hubFixture.down(pool).catch((e) => console.log("hub down:", e.message));
      await fixture.down(pool).catch((e) => console.log("fixture down:", e.message));
    }
    await pool.end();
  }
}

main().then(
  () => console.log(`frames in ${OUT}`),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
