// Dev-only test bank: Start a game's gallery (docs/PLAN-start-a-game-redo.md Round 2, TEMP-UI behind ?start=gallery) in each situation,
// for the round's screenshot story and its check. Real renders at a phone's size on a dev server reading a database with real seasons
// (the cast-properties lane's rfl_castprops: Survivor 51 through Episode 8 with Episode 9 next, Below Deck 13 with no results yet, The
// Challenge 42 all aired), as zt_nd_alex on gallery-fixture.js's couch (sam one episode behind, riley two). Each frame is its first
// view (<id>.jpg), the whole sheet when it scrolls (<id>.full.jpg), its words (<id>.txt); overlaps.json lists words drawn over words
// (DESIGN-PROCESS.md, "No words over words") and index.json each frame's measures. A frame that can't be reached prints SKIP.
//
//   A dev server on the real-seasons database, its AI keys blanked (nothing here asks our AI):
//     NEXT_DIST_DIR=.next-real AUTH_DATABASE_URL=<…/rfl_castprops> BETTER_AUTH_URL=http://localhost:3012 ANTHROPIC_API_KEY= \
//       LLM_BROWSER_API_URL= npx next dev -p 3012
//   node scripts/dev-test/story-start-gallery.js [--db=rfl_castprops] [--base-url=http://localhost:3012]
//        [--out=.ui-atlas/stories/wizard-r2/after] [--only=<regex on the frame id>] [--width=390 --height=844] [--keep]
//        [--before]   today's wizard instead (?start=wizard), on the same seasons and couch: the story's "before" frames (default
//                     --out .ui-atlas/stories/wizard-r2/before)
//        [--bold]     the bold pass (Round 2b, ?start=bold) on the same frames (default --out .ui-atlas/stories/wizard-r2b/after)
//   The user's notes on Round 2 (2026-11-18: saved games, the section's name and icon, Bingo & trivia) are the n* frames:
//     --only=^n --out=.ui-atlas/stories/wizard-r2-notes/after
// Each frame starts with this browser's saved games and the section's open state cleared (the gallery keeps them in localStorage
// until the build keeps them on the account); a frame that needs a save makes it through the hearts.
//
// Brings gallery-fixture.js up in --db and takes it down after (--keep leaves it). zt rows only; refuses a non-local database. Never
// run two checks on new-fixture.js's couch at once on the same database.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
process.env.BASE = opt("base-url", process.env.BASE || "http://localhost:3012");
const BASE = process.env.BASE;
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const galleryFixture = require("./gallery-fixture");

// Since B1 (docs/PLAN-start-a-game-redo.md) the bold gallery is Start a game everywhere: today's wizard and Round 2's gallery are gone,
// so --before (the old wizard) prints SKIP for its frames, and the bold frames are the default (--bold kept as a no-op).
const BEFORE = has("before");
// --bold: the bold pass (Round 2b, ?start=bold, src/new/couch/gallery-bold) on the same frames, for its story's after.
const BOLD = true;
const OUT = path.resolve(opt("out", BEFORE ? ".ui-atlas/stories/wizard-r2/before" : ".ui-atlas/stories/wizard-b1/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const DB0 = process.env.AUTH_DATABASE_URL || "";
const DB = opt("db", "rfl_castprops") ? DB0.replace(/\/([^/?]+)(\?.*)?$/, (m, d, q) => `/${opt("db", "rfl_castprops")}${q ?? ""}`) : DB0;
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-start-gallery runs against a local database only");
fs.mkdirSync(OUT, { recursive: true });

const wanted = (id) => !ONLY || new RegExp(ONLY).test(id);
const wait = (p, ms) => p.waitForTimeout(ms);
const top = (p) => p.locator('[role="dialog"]:visible').last();
const OVERLAPS = [];
const INDEX = [];

/** One frame: the first view, its words and overlaps, then the sheet laid out whole when it scrolls. */
async function shoot(p, id, note) {
  const base = path.join(OUT, id);
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await wait(p, 500);
  const face = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded"); }).catch(() => false);
  if (!face) throw new Error("Archivo never loaded (is the dev server mid-recompile?)");
  const hits = await overlapsIn(p, H).catch(() => []);
  OVERLAPS.push({ frame: id, hits });
  for (const h of hits) console.log(`OVERLAP ${id}: "${h[0]}" over "${h[1]}"`);
  await p.screenshot({ path: base + ".jpg", type: "jpeg", quality: 86 });
  fs.writeFileSync(base + ".txt", (await top(p).count()) ? await top(p).innerText() : await p.evaluate(() => document.body.innerText));
  const measures = await p.evaluate((h) => {
    const d = [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getBoundingClientRect().height > 0).at(-1) || document.body;
    const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < h && r.bottom > 0; };
    const controls = [...d.querySelectorAll("button, a[href], input, [role=radio], [role=switch]")].filter(visible).length;
    const sc = [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4);
    return { controls, screens: sc ? Math.round((sc.scrollHeight / sc.clientHeight) * 10) / 10 : 1 };
  }, H);
  const tall = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getBoundingClientRect().height > 0).at(-1);
    const sc = d && [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4);
    return d && sc ? d.getBoundingClientRect().height + (sc.scrollHeight - sc.clientHeight) : 0;
  });
  if (tall) {
    await p.setViewportSize({ width: W, height: Math.ceil(tall) + 80 });
    const style = await p.addStyleTag({ content: '[role="dialog"]{max-height:none!important} [role="dialog"] .overflow-y-auto{overflow:visible!important} [role="dialog"] .sticky{position:static!important}' });
    await wait(p, 500);
    const box = await top(p).boundingBox();
    if (box) await p.screenshot({ path: base + ".full.jpg", type: "jpeg", quality: 82, clip: { x: 0, y: Math.max(0, box.y), width: W, height: Math.ceil(box.height) } });
    else console.log(`NOFULL ${id}: no box (${await p.locator('[role="dialog"]').count()} dialogs)`);
    await style.evaluate((e) => e.remove());
    await p.setViewportSize({ width: W, height: H });
    await wait(p, 300);
  }
  INDEX.push({ id, note, ...measures, full: !!tall, overlaps: hits.length });
  console.log(`SHOT ${id}  (${measures.controls} controls in view, ${measures.screens} screens)${tall ? " + whole" : ""}`);
}

async function frame(id, note, fn) {
  if (!wanted(id)) return;
  try {
    const r = await fn();
    if (r === false) throw new Error("not reachable on this build");
    await shoot(PAGE, id, note);
  } catch (e) {
    const why = String((e && e.message) || e).split("\n")[0].slice(0, 200);
    console.log(`SKIP ${id}: ${why}`);
    INDEX.push({ id, note, skipped: why });
  }
}

let PAGE = null;
/** Open Start a game on a season's Games tab with the gallery switched on, and wait for the gallery. */
async function gallery(p, seasonId, { keep = false } = {}) {
  await p.goto(`${BASE}/show/${seasonId}/games`, { waitUntil: "domcontentloaded" });
  if (!keep)
    await p.evaluate(() => {
      localStorage.removeItem("gys_saved_games");
      localStorage.removeItem("gys_gallery_saved_open");
    });
  // Next's dev badge sits in the bottom corner, over a sheet's foot (the heart beside Start your own copy): hidden before any tap.
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const start = p.locator("[data-start-row], [data-play-start]").first();
  await start.waitFor({ timeout: 90000 });
  await start.click();
  await p.locator("[data-gallery=gallery]").waitFor({ timeout: 90000 });
  // The bold pass's lead tiles draw the cast from the Cast tab's read: wait for its faces (a show with no cast draws none).
  if (BOLD) await p.locator("[data-gallery-lead] img").first().waitFor({ timeout: 15000 }).catch(() => {});
  await wait(p, 700);
}
const tap = async (p, sel) => {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click();
  await wait(p, 450);
};
const scrollSheet = (p, sel) => p.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: "start" }));
const openBase = async (p, id) => {
  // A base is a square, or (in the bold pass) its category's lead tile.
  await tap(p, `[data-gallery-base="${id}"], [data-gallery-lead="${id}"]`);
  await p.locator("[data-gallery=base]").waitFor({ timeout: 20000 });
};

async function main() {
  const pool = new Pool({ connectionString: DB });
  let browser = null;
  let espn = null;
  try {
    const fx = await galleryFixture.up(pool);
    const S = Object.fromEntries(fx.seasons.map((s) => [s.label.startsWith("Survivor") ? "s51" : s.label.startsWith("Below") ? "bd13" : s.label.startsWith("Challenge") ? "c42" : s.label === "ZT Eagles" ? "nfl" : s.label === "ZT Sixers" ? "nba" : "t5", s.id]));
    console.log(`[fixture] couch ${fx.couchId}; seasons ${JSON.stringify(S)}`);
    // The bold pass's sports frames read the teams' marks from ESPN's lists: the stand-in check-sports-couch.js uses (its world, its
    // header), so the stand-in seasons show their own codes and colours. Shows don't ask it.
    if (BOLD || BEFORE) {
      try {
        const { TEAMS, EVENTS, LEAGUE_NAMES } = require("./check-sports-couch");
        espn = await require("./fake-espn").start({ teams: TEAMS, leagues: LEAGUE_NAMES, events: EVENTS });
      } catch (e) {
        console.log(`[espn] the stand-in didn't start: ${String(e.message || e).slice(0, 200)}`);
      }
    }
    browser = await open({ user: "zt_nd_alex", pass: "zt-pass-12345", width: W, height: H, motion: "off", headers: espn ? { "x-gys-sports": espn.url } : undefined });
    const p = browser.page;
    PAGE = p;
    // The couch's names as a couch's own would read (story-person-sheet.js's way): the fixture's prefix dropped from what the page
    // reads (every face would otherwise read Z); nothing in the database changes.
    await p.route("**/api/**", async (route) => {
      const res = await route.fetch().catch(() => null);
      if (!res) return route.abort();
      if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
      return route.fulfill({ response: res, body: (await res.text()).replace(/"zt_nd_([a-z]+)"/g, '"$1"') });
    });
    p.on("pageerror", (e) => console.log(`PAGEERROR ${e.message.split("\n")[0].slice(0, 200)}`));

    if (BEFORE) {
      // Round 1's wizard (start-wizard.tsx) is gone since B1: its frames are kept in .ui-atlas/stories/wizard-r2/before.
      console.log("SKIP before: today's wizard was replaced by the gallery in B1; the old frames are in .ui-atlas/stories/wizard-r2/before");
      return;
    }

    // ---- Survivor 51, mid-season: Episode 8 aired, Episode 9 next ----
    await frame("g1-first", "The gallery's first view", () => gallery(p, S.s51));
    await frame("g2-ready-open", "Ready games opened in place", async () => {
      await gallery(p, S.s51);
      await tap(p, "[data-gallery-community-toggle]");
    });
    await frame("g3-shelf", "Further down the shelf: pools and predictions", async () => {
      await gallery(p, S.s51);
      await tap(p, '[data-gallery-chip="pools"]');
      await wait(p, 600);
    });
    await frame("g4-search", "Search by any word: head to head", async () => {
      await gallery(p, S.s51);
      await p.locator("[data-gallery-find]").fill("head to head");
      await wait(p, 500);
    });
    await frame("g5-sentence", "A sentence in the field: build it from your words", async () => {
      await gallery(p, S.s51);
      await p.locator("[data-gallery-find]").fill("guess who wins immunity and who goes home each week, double or nothing on the boot");
      await wait(p, 500);
    });
    await frame("b1-outlast", "Outlast: fitted to who's left; riley would miss moves", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
    });
    await frame("b2-outlast-wait", "After Wait for riley", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
      await tap(p, "[data-gallery-wait]");
    });
    await frame("c1-compete", "Task 4: How you win on a Fantasy league, head to head chosen", async () => {
      await gallery(p, S.s51);
      await openBase(p, "fantasy");
      await tap(p, '[data-gallery-row="compete"]');
      await tap(p, '[data-gallery-choice="matchups"]');
    });
    await frame("c2-captain", "Task 4: Scoring, a captain", async () => {
      await gallery(p, S.s51);
      await openBase(p, "fantasy");
      await tap(p, "[data-gallery-more]");
      await tap(p, '[data-gallery-row="scoring"]');
      await tap(p, '[data-gallery-choice="captain"]');
    });
    await frame("c3-redraft", "Task 4: Over the season, a new draft at the merge", async () => {
      await gallery(p, S.s51);
      await openBase(p, "fantasy");
      await tap(p, "[data-gallery-more]");
      await tap(p, '[data-gallery-row="season"]');
      await tap(p, '[data-gallery-choice="redraft"]');
    });
    await frame("b3-task4", "Task 4 back on its screen: three rows changed, each with Undo", async () => {
      await gallery(p, S.s51);
      await openBase(p, "fantasy");
      await tap(p, '[data-gallery-popular-change="captain"]');
      await tap(p, "[data-gallery-more]");
      await tap(p, '[data-gallery-row="season"]');
      await tap(p, '[data-gallery-choice="redraft"]');
      await tap(p, "[data-gallery-done]");
      await scrollSheet(p, "[data-gallery-rows]");
    });
    await frame("b4-h2h", "Head-to-head league: lengths it can't take, dashed", async () => {
      await gallery(p, S.s51);
      await openBase(p, "h2h");
      await tap(p, '[data-gallery-length-chip="next"]');
    });
    await frame("b5-stage", "From the merge: it can't wait for people yet", async () => {
      await gallery(p, S.s51);
      await openBase(p, "fantasy");
      await tap(p, '[data-gallery-length-chip="from:merged"]');
    });
    await frame("l1-lock", "When moves lock, opened: where the couch is", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
      await tap(p, "[data-gallery-lock-change]");
    });
    await frame("b6-sheet", "Prediction sheet: the questions lead its rows", async () => {
      await gallery(p, S.s51);
      await scrollSheet(p, '[data-gallery-cat="predict"]');
      await openBase(p, "sheet");
      await scrollSheet(p, "[data-gallery-rows]");
    });
    await frame("q1-questions", "The questions: Add a question", async () => {
      await gallery(p, S.s51);
      await openBase(p, "sheet");
      await tap(p, '[data-gallery-row="play"]');
      await tap(p, "[data-gallery-add-question]");
    });
    await frame("c4-bank", "Bets on a game of guesses: a bank", async () => {
      await gallery(p, S.s51);
      await openBase(p, "sheet");
      await tap(p, '[data-gallery-row="bets"]');
      await tap(p, '[data-gallery-choice="bank"]');
    });
    await frame("c5-traitors", "A twisty game: Secret Traitors' own twist", async () => {
      await gallery(p, S.s51);
      await openBase(p, "traitors");
      await tap(p, "[data-gallery-more]");
      await tap(p, '[data-gallery-row="twists"]');
    });
    await frame("c6-who", "Who's playing: teams, a shared team, just me, the bot (coming)", async () => {
      await gallery(p, S.s51);
      await openBase(p, "fantasy");
      await tap(p, '[data-gallery-row="who"]');
      await tap(p, '[data-gallery-choice="teams"]');
    });
    await frame("t11-most", "Task 11: Who does it most?, the moment picked: crying, suggested", async () => {
      await gallery(p, S.s51);
      await scrollSheet(p, '[data-gallery-cat="predict"]');
      await openBase(p, "most");
      // Round 2's Change link; the bold pass shows the moments in view (Round 2c), so only tap it where it's there.
      if (await p.locator("[data-gallery-moment-change]").count()) await tap(p, "[data-gallery-moment-change]");
      await tap(p, '[data-gallery-moment-pick="cried"]');
    });
    await frame("p1-preview", "Preview how it plays: the practice round's steps", async () => {
      await gallery(p, S.s51);
      await openBase(p, "fantasy");
      await tap(p, "[data-gallery-preview]");
    });
    await frame("a1-ask", "Ask the couch first: the post the couch sees", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
      await tap(p, "[data-gallery-ask]");
    });
    await frame("a2-asked", "Back on the screen after asking", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
      await tap(p, "[data-gallery-ask]");
      await tap(p, "[data-gallery-post]");
    });
    await frame("d1-wait", "Describe: our AI's wait", async () => {
      await p.goto(`${BASE}/show/${S.s51}/games?start=gallery&describe=wait`, { waitUntil: "domcontentloaded" });
      await tap(p, "[data-start-row], [data-play-start]");
      await p.locator("[data-gallery=gallery]").waitFor({ timeout: 60000 });
      await p.locator("[data-gallery-find]").fill("guess who wins immunity and who goes home each week, double or nothing on the boot, finale counts double");
      await tap(p, "[data-gallery-build]");
    });
    await frame("d2-result", "Describe: what we heard, one thing to settle, answers that apply at once", async () => {
      await gallery(p, S.s51);
      await p.locator("[data-gallery-find]").fill("guess who wins immunity and who goes home each week, double or nothing on the boot, finale counts double");
      await tap(p, "[data-gallery-build]");
      await p.locator('[data-gallery-describe="result"]').waitFor({ timeout: 15000 });
    });
    await frame("d3-away", "Describe: our AI away", async () => {
      await p.goto(`${BASE}/show/${S.s51}/games?start=gallery&describe=away`, { waitUntil: "domcontentloaded" });
      await tap(p, "[data-start-row], [data-play-start]");
      await p.locator("[data-gallery=gallery]").waitFor({ timeout: 60000 });
      await p.locator("[data-gallery-find]").fill("guess who wins immunity each week");
      await tap(p, "[data-gallery-build]");
    });
    await frame("m1-community", "Every ready game: made for this season first", async () => {
      await gallery(p, S.s51);
      await tap(p, "[data-gallery-community-toggle]");
      await tap(p, "[data-gallery-community-all]");
    });
    await frame("m2-cgame", "A community game's screen: the engine's account before the maker's words", async () => {
      await gallery(p, S.s51);
      await tap(p, "[data-gallery-community-toggle]");
      await tap(p, "[data-gallery-community-all]");
      const safety = p.locator("[data-gallery-community-row]", { hasText: "Safety Net" }).first();
      if (await safety.count()) await safety.click();
      else await tap(p, "[data-gallery-community-row]");
      await wait(p, 500);
    });
    await frame("s1-done", "Start: what it would make (Round 2 saves nothing)", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
      await tap(p, "[data-gallery-start]");
    });

    // ---- The user's notes on Round 2 (2026-11-18) ----
    /** Save a game through its heart: its screen, the heart beside Start, back to the gallery. */
    const saveFrom = async (id) => {
      await openBase(p, id);
      await tap(p, "[data-gallery-save]");
      await p.locator('[data-gallery-save][aria-pressed="true"]').waitFor({ timeout: 5000 });
      await tap(p, '[role="dialog"]:visible [data-sheet-back]');
      await p.locator("[data-gallery=gallery]").waitFor({ timeout: 20000 });
    };
    const scrollToTop = (p) => p.evaluate(() => document.querySelector('[role="dialog"] .overflow-y-auto')?.scrollTo(0, 0));
    await frame("n1-first", "The gallery's first view: Community and saved games, a button with its icon", () => gallery(p, S.s51));
    await frame("n2-open", "Opened before anything's saved: the season's ready games, and how to save one", async () => {
      await gallery(p, S.s51);
      await tap(p, "[data-gallery-community-toggle]");
    });
    await frame("n3-heart", "Outlast's screen: the heart beside Start", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
    });
    await frame("n4-saved", "The heart tapped: saved, and where it went", async () => {
      await gallery(p, S.s51);
      await openBase(p, "outlast");
      await tap(p, "[data-gallery-save]");
      await wait(p, 250);
    });
    await frame("n5-open-saved", "Back on the gallery: your saved games first, then the season's", async () => {
      await gallery(p, S.s51);
      await saveFrom("outlast");
      await scrollToTop(p);
      await tap(p, "[data-gallery-community-toggle]");
      await scrollToTop(p);
    });
    await frame("n6-list", "See all: Saved, then the Community with its sorts", async () => {
      await gallery(p, S.s51);
      await saveFrom("outlast");
      await scrollToTop(p);
      await tap(p, "[data-gallery-community-toggle]");
      await tap(p, "[data-gallery-community-all]");
    });
    await frame("n7-cgame", "A ready game's screen: its heart beside Start your own copy, saved", async () => {
      await gallery(p, S.s51);
      await tap(p, "[data-gallery-community-toggle]");
      await tap(p, "[data-gallery-community-all]");
      const safety = p.locator("[data-gallery-community-row]", { hasText: "Safety Net" }).first();
      if (await safety.count()) await safety.click();
      else await tap(p, "[data-gallery-community-row]");
      await wait(p, 400);
      await tap(p, "[data-gallery-save]");
      await wait(p, 250);
    });
    await frame("n11-repeat", "Repeat: the saved game opened, its heart filled, ready to start", async () => {
      await gallery(p, S.s51);
      await saveFrom("outlast");
      await scrollToTop(p);
      await tap(p, "[data-gallery-community-toggle]");
      await tap(p, "[data-gallery-saved-row]");
      await p.locator("[data-gallery=base]").waitFor({ timeout: 20000 });
    });
    await frame("n8-quiz", "Bingo & trivia: a card while it's on, a quiz after", async () => {
      await gallery(p, S.s51);
      await tap(p, '[data-gallery-chip="quiz"]');
      await wait(p, 700);
    });
    await frame("n9-predict", "Predictions: Live calls beside The show's calls", async () => {
      await gallery(p, S.s51);
      await p.locator('[data-gallery-base="livecalls"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
      await wait(p, 500);
    });
    if (S.bd13)
      await frame("n10-other-show", "Next show: Survivor 51's saved Outlast, opened on Below Deck 13's gallery", async () => {
        await gallery(p, S.s51);
        await saveFrom("outlast");
        await gallery(p, S.bd13, { keep: true });
        await tap(p, "[data-gallery-community-toggle]");
      });

    // ---- The bold pass (Round 2b, --bold): each category's lead tile, Make it…, the rules, Find a change, your own moments ----
    if (BOLD) {
      const leadOf = async (chip) => {
        await gallery(p, S.s51);
        await tap(p, `[data-gallery-chip="${chip}"]`);
        await wait(p, 700);
      };
      for (const [id, chip, note] of [
        ["y1-pools", "pools", "Pools: the next episode, who stays, a face marked safe"],
        ["y2-predict", "predict", "Predictions: the next episode's own questions"],
        ["y3-bets", "bets", "Betting: one worked bet from the bank"],
        ["y4-versus", "versus", "Head to head: the couch paired off"],
        ["y5-quiz", "quiz", "Bingo & trivia: a card of the show's own moments"],
        ["y6-party", "party", "Party: the couch, two of them masked"],
        ["y7-season", "season", "Big season: the season in its stages"],
      ])
        await frame(id, note, () => leadOf(chip));
      const fantasy = async () => {
        await gallery(p, S.s51);
        await tap(p, '[data-gallery-lead="fantasy"]');
        await p.locator("[data-gallery=base]").waitFor({ timeout: 20000 });
      };
      await frame("y8-fantasy", "Fantasy league's screen: the title card on the show's art", fantasy);
      await frame("y9-makeit", "Make it… More competitive tapped: head to head, its rule marked", async () => {
        await fantasy();
        await scrollSheet(p, "[data-gallery-make-section]");
        await tap(p, '[data-gallery-make="comp"]');
        await wait(p, 300);
        await scrollSheet(p, "[data-gallery-make-section]");
      });
      await frame("y10-rules", "The rules: every row in view, the value first", async () => {
        await fantasy();
        await scrollSheet(p, "[data-gallery-rows]");
      });
      await frame("y11-find", "Find a change: \"captain\"", async () => {
        await fantasy();
        await scrollSheet(p, "[data-gallery-find-change]");
        await p.locator("[data-gallery-find-change-input]").fill("captain");
        await wait(p, 400);
        await scrollSheet(p, "[data-gallery-find-change]");
      });
      await frame("y12-own", "Your own moments: a suggestion and one typed", async () => {
        await fantasy();
        await tap(p, '[data-gallery-row="own"]');
        await p.locator("[data-gallery-own-moments]").waitFor({ timeout: 10000 });
        await tap(p, "[data-gallery-own-suggest] button");
        await p.locator("[data-gallery-own-input]").fill("A tribe swap at camp");
        await tap(p, "[data-gallery-own-add]");
      });
      await frame("y13-aka", "Search by what fans call it: \"eliminator\"", async () => {
        await gallery(p, S.s51);
        await p.locator("[data-gallery-find]").fill("eliminator");
        await wait(p, 500);
      });
      await frame("y14-outlast-casual", "Outlast: More casual has nowhere to go, and says so", async () => {
        await gallery(p, S.s51);
        await openBase(p, "outlast");
        await scrollSheet(p, "[data-gallery-make-section]");
      });
    }

    // ---- Sports through the same gallery (the bold pass; the stand-in seasons check-sports-couch.js --keep leaves) ----
    if (BOLD) {
      for (const [key, name] of [
        ["nfl", "football: the Eagles' season"],
        ["nba", "basketball: the Sixers–Knicks series"],
      ]) {
        if (!S[key]) {
          console.log(`SKIP ${key}: no stand-in season (run check-sports-couch.js --api --keep on this database first)`);
          continue;
        }
        await frame(`z-${key}-first`, `Sports, ${name}: the same gallery`, () => gallery(p, S[key]));
        await frame(`z-${key}-shelf`, `Sports, ${name}: further down the shelves`, async () => {
          await gallery(p, S[key]);
          await tap(p, '[data-gallery-chip="predict"]');
          await wait(p, 700);
        });
        await frame(`z-${key}-base`, `Sports, ${name}: a game's screen, the same parts`, async () => {
          await gallery(p, S[key]);
          await tap(p, "[data-gallery-lead]");
          await p.locator("[data-gallery=base]").waitFor({ timeout: 20000 });
        });
        await frame(`z-${key}-own`, `Sports, ${name}: your own moments, the sport's oddities`, async () => {
          await gallery(p, S[key]);
          await tap(p, "[data-gallery-lead]");
          await p.locator("[data-gallery=base]").waitFor({ timeout: 20000 });
          await tap(p, '[data-gallery-row="own"]');
          await p.locator("[data-gallery-own-moments]").waitFor({ timeout: 10000 });
          await tap(p, "[data-gallery-own-suggest] button");
        });
      }
    }

    // ---- Below Deck 13: a story show, no results yet, three stages ----
    if (S.bd13) {
      await frame("bd1-first", "Below Deck 13: the gallery on a story show", () => gallery(p, S.bd13));
      await frame("bd2-base", "Below Deck 13: three stages make its lengths", async () => {
        await gallery(p, S.bd13);
        await tap(p, "[data-gallery-base]");
        await p.locator("[data-gallery=base]").waitFor({ timeout: 20000 });
      });
    }
    // ---- The Challenge 42: finished airing, every game at your own pace ----
    if (S.c42) {
      await frame("c42-first", "The Challenge 42: a season that's aired, the gallery open", () => gallery(p, S.c42));
      await frame("c42-base", "The Challenge 42: at your own pace, nothing to choose", async () => {
        await gallery(p, S.c42);
        await openBase(p, "fantasy");
      });
    }
  } finally {
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 2));
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(INDEX, null, 2));
    if (browser) await browser.close().catch(() => {});
    if (espn) await espn.close().catch(() => {});
    if (!has("keep")) await galleryFixture.down(pool).catch((e) => console.log(`[fixture] down failed: ${e.message}`));
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
