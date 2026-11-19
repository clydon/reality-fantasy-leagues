// Round 4's frames (docs/PLAN-start-a-game-redo.md, "Round 4: changing a game later"): Backstage › Game settings and the ways into it,
// shot at a phone's size for the screenshot story, before and after the round's design. One list serves both: a missing selector is
// skipped, not failed.
//
// Situations (--only=<regex on the id>):
//   settings-alex       Game settings as alex, who runs new-fixture.js's three games (Outlast, Weekly Lineup, Survival Pool)
//   settings-riley      the same as riley, a Game admin in the lineup game (reads, can't change)
//   settings-busy       alex on short-games-fixture.js's busy season: the three games and 60 one-episode games
//   game-menu           a game's page, its ⋯ menu open (the way into a game's settings from the game)
//   settings-game       one game's settings, opened from the game's ⋯ menu (Round 4; skipped before it)
//   list-game           one game's settings, opened from Backstage's list (Round 4)
//   line-pace           the same, How moves lock opened (Round 4)
//   line-lineup         Weekly Lineup's settings, Who scores each week opened (Round 4)
//   riley-game          Weekly Lineup's settings as riley, a Game admin (Round 4)
// --after: Round 4's design (?settings=r4).
// For each it keeps <id>.jpg (the first view), <id>.full.jpg, <id>.txt, and prints OVERLAP lines (words over words: overlaps.js).
//
// Needs: the app (BASE). Brings the fixtures up and takes them down after unless --keep. zt-nd rows only; refuses a non-local
// database. Shares new-fixture's zt_nd_ couch: never run beside another check on it.
// Run:   node scripts/dev-test/story-game-settings.js --out=.ui-atlas/stories/round4-game-settings/before [--width=390 --height=844] [--only=<regex>] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./new-fixture");
const shortGames = require("./short-games-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const OUT = path.resolve(opt("out", ".ui-atlas/stories/round4-game-settings/before"));
const ONLY = opt("only", null);
const Q = has("after") ? "?settings=r4" : "";
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-game-settings runs against a local database only");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function frame(page, id) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 84 });
  await page.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await page.evaluate(() => document.body.innerText));
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${id}: "${a}" on "${b}"`);
  console.log(`PASS ${id}`);
}

async function shoot(list) {
  let failed = 0;
  for (const x of list.filter((x) => x.go && (!ONLY || new RegExp(ONLY).test(x.id)))) {
    const b = await open({ user: fixture.username(x.who), pass: fixture.PASSWORD, width: W, height: H, motion: "reduce" });
    try {
      await b.page.goto(b.BASE + x.go, { waitUntil: "networkidle", timeout: 90000 });
      await b.page.locator(x.ready).first().waitFor({ timeout: 45000 });
      await sleep(1500);
      let skipped = false;
      for (const t of x.tap ? (Array.isArray(x.tap) ? x.tap : [x.tap]) : []) {
        const el = typeof t === "string" ? b.page.locator(t).first() : b.page.getByText(t.text, { exact: true }).first();
        if (!(await el.count())) {
          console.log(`(skip ${x.id}: no ${typeof t === "string" ? t : t.text})`);
          skipped = true;
          break;
        }
        await el.click();
        await sleep(1200);
      }
      if (skipped) continue;
      if (x.wait) await b.page.locator(x.wait).first().waitFor({ timeout: 20000 }).catch(() => console.log(`(no ${x.wait} in ${x.id})`));
      await frame(b.page, x.id);
      if (b.errors.length) console.log(`ERRORS ${x.id}: ${b.errors.slice(0, 3).join(" | ")}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${x.id}: ${e.message.split("\n")[0]}`);
      await b.page.screenshot({ path: path.join(OUT, `${x.id}.fail.jpg`), type: "jpeg" }).catch(() => {});
    } finally {
      await b.close();
    }
  }
  return failed;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  let failed = 0;
  try {
    const fx = await fixture.up(pool);
    const S = fx.seasonId;
    failed += await shoot([
      { id: "settings-alex", who: "alex", go: `/show/${S}/backstage/settings${Q}`, ready: "[data-settings], [data-settings-game], [data-settings-list], h1, h2" },
      { id: "settings-riley", who: "riley", go: `/show/${S}/backstage/settings${Q}`, ready: "[data-settings], [data-settings-game], [data-settings-list], h1, h2" },
      { id: "game-menu", who: "alex", go: `/show/${S}/game/${fx.leagues.lineup}${Q}`, ready: "[data-game-page]", tap: "[data-game-title] [data-game-menu-open]", wait: '[role="dialog"]' },
      { id: "settings-game", who: "alex", go: has("after") ? `/show/${S}/game/${fx.leagues.lineup}${Q}` : null, ready: "[data-game-page]", tap: ["[data-game-title] [data-game-menu-open]", "[data-game-menu] :text-is(\"Game settings\")"], wait: "[data-game-settings]" },
      { id: "list-game", who: "alex", go: has("after") ? `/show/${S}/backstage/settings${Q}` : null, ready: "[data-settings-list]", tap: `[data-settings-row="${fx.leagues.outlast}"]`, wait: "[data-game-settings]" },
      { id: "line-pace", who: "alex", go: has("after") ? `/show/${S}/backstage/settings${Q}` : null, ready: "[data-settings-list]", tap: [`[data-settings-row="${fx.leagues.lineup}"]`, '[data-setting-line="pace"] button'], wait: '[data-settings="pace"]' },
      { id: "line-lineup", who: "alex", go: has("after") ? `/show/${S}/backstage/settings${Q}` : null, ready: "[data-settings-list]", tap: [`[data-settings-row="${fx.leagues.lineup}"]`, '[data-setting-line="lineup"] button'], wait: '[data-settings="lineup"]' },
      { id: "riley-game", who: "riley", go: has("after") ? `/show/${S}/backstage/settings${Q}` : null, ready: "[data-settings-list]", tap: `[data-settings-row="${fx.leagues.lineup}"]`, wait: "[data-game-settings]" },
    ]);
    await fixture.down(pool);
    if (!ONLY || new RegExp(ONLY).test("settings-busy")) {
      const busy = await shortGames.up(pool, { open: true });
      failed += await shoot([
        { id: "settings-busy", who: "alex", go: `/show/${busy.seasonId}/backstage/settings${Q}`, ready: "[data-settings], [data-settings-game], [data-settings-list], h1, h2" },
        // Round 4: a finished game's settings (only Archive or delete left), and one of the next episode's one-episode games.
        { id: "busy-finished", who: "alex", go: has("after") ? `/show/${busy.seasonId}/backstage/settings${Q}` : null, ready: "[data-settings-list]", tap: ['[data-settings-fold="done"] button', '[data-settings-fold="done"] [data-settings-row]'], wait: "[data-game-settings]" },
        { id: "busy-night", who: "alex", go: has("after") ? `/show/${busy.seasonId}/backstage/settings${Q}` : null, ready: "[data-settings-list]", tap: ['[data-settings-fold^="ep-"] button', '[data-settings-fold^="ep-"] [data-settings-row]'], wait: "[data-game-settings]" },
      ]);
    }
  } finally {
    if (!has("keep")) await shortGames.down(pool);
    await pool.end();
  }
  console.log(failed ? `${failed} FAILED` : "ALL CAPTURED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
