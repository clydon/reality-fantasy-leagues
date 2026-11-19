// Round 3's frames (docs/PLAN-start-a-game-redo.md, "Round 3: a show's games when short games are frequent"): short-games-fixture.js's
// busy season (about 60 one-episode games over 20 episodes on new-fixture's couch), shot at a phone's size for the screenshot story,
// before and after the round's design. One list serves both: a missing selector is skipped, not failed.
//
// Situations (each a viewer and a page; --only=<regex on the id>):
//   games-alex        the Games tab as alex (seen everything): what's on, and where the finished games went
//   games-sam         the same as sam, two episodes behind (spoiler-safe: nothing past his mark)
//   tonight-alex      Tonight as alex, Episode 20's three short games waiting beside the season's games
//   tonight-sam       Tonight as sam, behind: his next episode's games
//   reveal-sam        sam's reveal of his next episode: every game it ended, then the season's (beats shot as reveal-2 and on)
//   archive-alex      the archive (Round 3's new screen) as alex, and its next page (archive-alex.more)
//   archive-sam       the archive as sam: nothing past his mark
//   archived-game     a finished game's own page, opened from the archive
//   archive-kind      the archive narrowed to one kind of game (its record and its list)
// For each it keeps <id>.jpg (the first view), <id>.full.jpg, <id>.txt, and prints OVERLAP lines (words over words: overlaps.js).
//
// Needs: the app (BASE, default :3000; this lane's .env.local says :3013). Brings short-games-fixture.js up with --episodes,
// --through and --each (Round 3's 30-episode season: --episodes=30 --through=29) and takes it down after unless --keep; --reuse shoots
// a fixture already up (`short-games-fixture.js up`). zt-nd rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch:
// never run beside another check on it.
// Run:   node scripts/dev-test/story-short-games.js --out=.ui-atlas/stories/round3-short-games/before [--episodes=20 --through=19 --each=3]
//          [--width=390 --height=844] [--only=<regex>] [--keep] [--reuse]
//          [--bots=2] (alex's short games against computer players: the couch of one)
//          [--no-next] (the next episode has no games yet: Again, on the Games tab's results and a finished game's page)
// Round 3's design is the app's since B3 (2026-11-18); its before frames were shot with ?games=r3 off, when it was a switch.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const shortGames = require("./short-games-fixture");
const fixture = require("./new-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const OUT = path.resolve(opt("out", ".ui-atlas/stories/round3-short-games/before"));
const ONLY = opt("only", null);
const EPISODES = Number(opt("episodes", 20));
const THROUGH = Number(opt("through", EPISODES - 1));
const EACH = Number(opt("each", 3));
const BOTS = Number(opt("bots", 0));
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-short-games runs against a local database only");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function frame(page, id, { full = true } = {}) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 84 });
  if (full) await page.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await page.evaluate(() => document.body.innerText));
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${id}: "${a}" on "${b}"`);
  console.log(`PASS ${id}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  let fx;
  if (has("reuse")) {
    const { rows } = await pool.query(`SELECT l.id, l.name, l.slug FROM leagues l WHERE l.slug LIKE 'zt-nd-short-%' ORDER BY l.slug`);
    const season = await pool.query(`SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = 'zt-nd-survivor' LIMIT 1`).catch(() => ({ rows: [] }));
    fx = { seasonId: season.rows[0]?.id, games: rows.map((r) => ({ leagueId: r.id, name: r.name, episode: Number(r.slug.split("-")[3]) })) };
    if (!fx.seasonId || !fx.games.length) throw new Error("--reuse: no short-games fixture up (short-games-fixture.js up)");
  } else fx = await shortGames.up(pool, { episodes: EPISODES, through: THROUGH, each: EACH, open: true, bots: BOTS, next: !has("no-next") });
  const S1 = fx.seasonId;
  const q = "";
  // A game sam has seen end (his mark is two behind): the newest one over by his mark, for the finished game's page.
  const ended = fx.games.filter((g) => g.episode <= THROUGH - 2).sort((a, b) => b.episode - a.episode)[0];
  const newest = fx.games.filter((g) => g.episode <= THROUGH).sort((a, b) => b.episode - a.episode)[0];
  console.log(`[short] ${fx.games.length} short games on ${S1}; a finished one: ${ended?.leagueId} (Episode ${ended?.episode})`);

  const list = [
    { id: "games-alex", who: "alex", go: `/show/${S1}/games${q}`, ready: '[data-tab="games"]' },
    { id: "games-sam", who: "sam", go: `/show/${S1}/games${q}`, ready: '[data-tab="games"]' },
    { id: "tonight-alex", who: "alex", go: `/show/${S1}${q}`, ready: "[data-progress], [data-strip], main section" },
    { id: "tonight-sam", who: "sam", go: `/show/${S1}${q}`, ready: "[data-progress], [data-strip], main section" },
    // The reveal: a full-screen dialog that stays in the page hidden (wait on one that's showing), then its beats, tapping its stage.
    { id: "archive-alex", who: "alex", go: `/show/${S1}/games${q}`, ready: '[data-tab="games"]', tap: "[data-archive-open]", wait: "[data-archive]", more: "[data-archive-more]" },
    { id: "archive-sam", who: "sam", go: `/show/${S1}/games${q}`, ready: '[data-tab="games"]', tap: "[data-archive-open]", wait: "[data-archive]" },
    { id: "archived-game", who: "sam", go: ended ? `/show/${S1}/game/${ended.leagueId}${q}` : null, ready: "[data-game-page]" },
    // --no-next: Again on the Games tab's results, and on the newest finished game's page.
    { id: "again-tab", who: "alex", go: has("no-next") ? `/show/${S1}/games${q}` : null, ready: '[data-tab="games"]', scroll: "[data-again-line]" },
    { id: "again-game", who: "alex", go: has("no-next") && newest ? `/show/${S1}/game/${newest.leagueId}${q}` : null, ready: "[data-game-page]", scroll: "[data-again]" },
    // The archive's kind chips: one kind's record and list.
    { id: "archive-kind", who: "alex", go: `/show/${S1}/games${q}`, ready: '[data-tab="games"]', tap: "[data-archive-open]", wait: "[data-archive-kinds]", then: "[data-archive-kinds] button:nth-child(2)" },
    // Behind on an airing show, Tonight asks "Seen Ep 18?": Yes, then the guard's "Yes, Ep 18" plays every game's results (it writes
    // sam's mark: shoot it last).
    { id: "reveal-sam", who: "sam", go: `/show/${S1}${q}`, ready: "[data-progress], [data-strip], main section", tap: "[data-ask-yes], [data-progress-reveal]", then: "[data-step-guard-yes]", wait: '[role="dialog"]:not([aria-hidden="true"]) [data-stage]', beats: 8 },
  ].filter((x) => x.go && (!ONLY || new RegExp(ONLY).test(x.id)));

  let failed = 0;
  for (const x of list) {
    const b = await open({ user: fixture.username(x.who), pass: fixture.PASSWORD, width: W, height: H });
    try {
      await b.page.goto(b.BASE + x.go, { waitUntil: "networkidle", timeout: 90000 });
      await b.page.waitForSelector(x.ready, { timeout: 45000 });
      await sleep(1500);
      if (x.tap) {
        const el = await b.page.$(x.tap);
        if (!el) {
          console.log(`(skip ${x.id}: no ${x.tap})`);
          continue;
        }
        await el.click();
        await sleep(900);
        if (x.then) {
          await b.page.locator(x.then).first().click({ timeout: 15000 }).catch(() => console.log(`(no ${x.then} in ${x.id})`));
          await sleep(2500);
        }
      }
      if (x.wait) await b.page.locator(x.wait).first().waitFor({ timeout: 30000 }).catch(() => console.log(`(no ${x.wait} in ${x.id})`));
      if (x.scroll) await b.page.locator(x.scroll).first().scrollIntoViewIfNeeded({ timeout: 20000 }).catch(() => console.log(`(no ${x.scroll} in ${x.id})`));
      await sleep(900);
      await frame(b.page, x.id);
      if (x.more) {
        const m = await b.page.$(x.more);
        if (m) {
          await m.click();
          await sleep(1500);
          await frame(b.page, `${x.id}.more`);
        }
      }
      for (let k = 2; k <= (x.beats ?? 0); k++) {
        const stage = await b.page.$('[role="dialog"]:not([aria-hidden="true"]) [data-reveal-stage], [role="dialog"]:not([aria-hidden="true"]) [data-stage]');
        if (!stage) break;
        await stage.click().catch(() => {});
        await sleep(1400);
        await frame(b.page, `${x.id}.reveal-${k}`, { full: false });
      }
      if (b.errors.length) console.log(`ERRORS ${x.id}: ${b.errors.slice(0, 3).join(" | ")}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${x.id}: ${e.message.split("\n")[0]}`);
      await b.page.screenshot({ path: path.join(OUT, `${x.id}.fail.jpg`), type: "jpeg" }).catch(() => {});
    } finally {
      await b.close();
    }
  }
  if (!has("keep") && !has("reuse")) await shortGames.down(pool);
  await pool.end();
  console.log(failed ? `${failed} FAILED` : "ALL CAPTURED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
