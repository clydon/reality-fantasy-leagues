// The design round's step 6 frames (the Games tab with the draft room): draft-fixture.js's couch mid-draft, shot at a phone's size
// for the screenshot story, before and after a redesign. One list serves both: a missing selector is skipped, not failed.
//
// Situations (each a viewer and a page; --only=<regex on the id>):
//   draft-games-alex     the draft couch's Games tab as alex while Couch Cup's draft is on (a draft game's row before any points)
//   draft-room-waiting   the room as jordan, someone else on the clock (riley or sam), the order and the board
//   draft-room-up        the room as whoever is on the clock (alex at --live=6), a castaway tapped and the sheet closed: the confirm bar
//   draft-sheet          the same tap, the castaway's sheet open (who they are, their season so far; Queue and Draft at its foot)
//   sport-sheet          an athlete's sheet in Gridiron's room (past seasons from ESPN when the recording gave ids)
//   sport-sheet-past     the same, scrolled to the past seasons' table
//   draft-room-teams     the room's Picks board (Teams before step 6): who has whom so far
//   draft-room-queue     the room's queue as alex (three starred)
//   draft-blind          Lineup League's blind draft as alex (started first: the API's Start as alex)
//   sport-room           Gridiron's room as jordan: 344 athletes, a snake draft of 15 (--sport)
//   sport-room-search    the same, a search typed ("allen") and a position chosen, where the design has them
//   sport-games          ZT Football's Games tab as alex
// For each it keeps <id>.jpg (the first view), <id>.full.jpg, <id>.txt, and prints OVERLAP lines (words over words: overlaps.js).
//
// Needs: the app on :3000 (npm run dev). Brings draft-fixture.js up (--live picks in, --sport for the 344 pool) and takes it
// down after unless --keep. zt-dr rows only; refuses a non-local database.
// Run:   node scripts/dev-test/story-draft.js --out=.ui-atlas/stories/step6-games/before/draft [--live=6] [--needs: Couch Cup needs two men and two women] [--width=390 --height=844]
//          [--only=<regex>] [--keep]
// Real athletes' headshots appear when the ESPN recording is on this machine: keep those frames in the ignored .ui-atlas.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./draft-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const OUT = path.resolve(opt("out", ".ui-atlas/stories/draft"));
const ONLY = opt("only", null);
const LIVE = Number(opt("live", 6));
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-draft runs against a local database only");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function frame(page, id, { full = true } = {}) {
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 82 });
  if (full) await page.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await page.evaluate(() => document.body.innerText));
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${id}: "${a}" on "${b}"`);
  console.log(`PASS ${id}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  const fx = await fixture.up(pool, { live: LIVE, sport: true, needs: args.includes("--needs") });
  // Who's on the clock, by the league's own state.
  const clockOf = async (leagueId) => {
    const s = (await pool.query(`SELECT state FROM leagues WHERE id = $1`, [leagueId])).rows[0].state;
    const S = require("../../src/lib/game/state-logic.js");
    const t = S.currentDraftTurn(s);
    return t ? s.players.find((p) => p.id === t.playerId)?.name : null;
  };
  const up = await clockOf(fx.leagues.outlast);
  const waiter = ["jordan", "sam", "riley", "alex"].find((w) => w !== up);
  // The blind draft started (alex is its Commissioner) so the room is live.
  const alexApi = await api({ user: fixture.username("alex"), pass: fixture.PASSWORD });
  await alexApi.call("POST", `/api/seasons/${fx.seasonId}/draft`, { leagueId: fx.leagues.lineup, action: "start" }).catch((e) => console.log("blind start:", e.message));
  console.log(`[draft] on the clock in Couch Cup: ${up}; waiting viewer ${waiter}`);

  const S1 = fx.seasonId, SP = fx.sport.seasonId;
  const draftUrl = (season, league) => `/show/${season}/draft?game=${league}`;
  const list = [
    { id: "draft-games-alex", who: "alex", go: `/show/${S1}/games`, ready: '[data-tab="games"]' },
    { id: "draft-room-waiting", who: waiter, go: draftUrl(S1, fx.leagues.outlast), ready: "[data-draft]" },
    // A tap opens the castaway's sheet (step 6's follow-up) and, when you're up, selects them: closed, the confirm bar offers Draft.
    { id: "draft-room-up", who: up, go: draftUrl(S1, fx.leagues.outlast), ready: "[data-draft]", tap: "[data-tile]:not([disabled])", press: "Escape" },
    { id: "draft-sheet", who: up, go: draftUrl(S1, fx.leagues.outlast), ready: "[data-draft]", tap: "[data-tile]:not([disabled])", wait: '[role="dialog"]' },
    { id: "draft-room-teams", who: waiter, go: draftUrl(S1, fx.leagues.outlast), ready: "[data-draft]", tap: '[data-seg="picks"], [data-seg="teams"]' },
    { id: "draft-room-queue", who: "alex", go: draftUrl(S1, fx.leagues.outlast), ready: "[data-draft]", tap: '[data-seg="queue"], [data-draft-view="queue"]' },
    { id: "draft-blind", who: "alex", go: `/show/${S1}/blind?game=${fx.leagues.lineup}`, ready: "[data-draft]" },
    { id: "sport-room", who: "jordan", go: draftUrl(SP, fx.sport.leagueId), ready: "[data-draft]" },
    { id: "sport-room-search", who: "jordan", go: draftUrl(SP, fx.sport.leagueId), ready: "[data-draft]", type: { sel: "[data-draft-search]", text: "allen" }, tap: '[data-draft-pos="QB"]' },
    { id: "sport-games", who: "alex", go: `/show/${SP}/games`, ready: '[data-tab="games"]' },
    // An athlete's sheet: who they are and their past seasons (ESPN, when the recording gave them ids), the draft's actions at its foot.
    { id: "sport-sheet", who: "jordan", go: draftUrl(SP, fx.sport.leagueId), ready: "[data-draft]", tap: "[data-draft-list] [data-tile]", wait: "[data-past-seasons], [data-draft-sheet-body]" },
    { id: "sport-sheet-past", who: "jordan", go: draftUrl(SP, fx.sport.leagueId), ready: "[data-draft]", tap: "[data-draft-list] [data-tile]", wait: "[data-past-seasons]", scroll: "[data-season-table]" },
  ].filter((x) => !ONLY || new RegExp(ONLY).test(x.id));

  let failed = 0;
  for (const x of list) {
    const b = await open({ user: fixture.username(x.who), pass: fixture.PASSWORD, width: W, height: H });
    try {
      await b.page.goto(b.BASE + x.go, { waitUntil: "networkidle", timeout: 60000 });
      await b.page.waitForSelector(x.ready, { timeout: 30000 });
      await sleep(1200);
      if (x.type && (await b.page.$(x.type.sel))) await b.page.fill(x.type.sel, x.type.text);
      if (x.tap) {
        const el = await b.page.$(x.tap);
        if (el) {
          await el.click();
          await sleep(700);
        } else console.log(`(skip tap ${x.id}: ${x.tap})`);
      }
      // `wait`: what the tap opens (a sheet and what it reads); `scroll`: bring a part of it into view; `press`: a key after (Escape
      // closes a sheet, leaving what the tap selected).
      if (x.wait) await b.page.locator(x.wait).first().waitFor({ timeout: 20000 }).catch(() => console.log(`(no ${x.wait} in ${x.id})`));
      if (x.scroll) await b.page.locator(x.scroll).first().scrollIntoViewIfNeeded().catch(() => {});
      if (x.press) {
        await b.page.keyboard.press(x.press);
        await sleep(600);
      }
      if (x.wait || x.scroll) await sleep(800);
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
  if (!has("keep")) await fixture.down(pool);
  await pool.end();
  console.log(failed ? `${failed} FAILED` : "ALL CAPTURED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
