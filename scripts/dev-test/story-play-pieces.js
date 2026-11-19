// B2's frames (docs/PLAN-start-a-game-redo.md, B2: the play pieces a game's page can't play yet), shot at a phone's size for the
// screenshot story, before and after the round's design, on play-pieces-fixture.js's cases (brought up first: `up`).
//
// For each case's game, as the case's viewer (Ann; in `cut`, whoever the cut knocked out):
//   <case>[-<game>]-page   the game's page: <id>.jpg (the first view), <id>.full.jpg (the whole page), <id>.txt
//   <case>[-<game>]-move   Your moves for the game (opened by its address, ?moves=<tab>&game=<id>, as the hub does)
//   <case>[-<game>]-you    your own sheet (the page's You door)
// and each case's flows (FLOWS below: a tap in the sheet and what it shows), e.g. captain-change, second-both, slots-bo-open.
// A missing selector is skipped, not failed. OVERLAP lines name words sitting on other words (overlaps.js).
//
// Needs: the app (BASE from .env.local) and the fixture: node scripts/dev-test/play-pieces-fixture.js up
// Run:   node scripts/dev-test/story-play-pieces.js --out=.ui-atlas/stories/b2-play-pieces/before [--only=<regex on the id>]
//          [--width=390 --height=844] [--q=<query string, e.g. play=b2>]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./play-pieces-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const OUT = path.resolve(opt("out", ".ui-atlas/stories/b2-play-pieces/before"));
const ONLY = opt("only", null);
const QS = opt("q", "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function frame(page, id, sheet) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 84 });
  await page.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  // A sheet's words are the .txt (its popup's, not the page's under it).
  const dialog = sheet ? page.locator("[data-sheet-handle]").last().locator("xpath=..") : null;
  if (dialog && (await dialog.count())) {
    const box = dialog.locator("[data-sheet-body], .overflow-y-auto").first();
    if (await box.count()) await box.evaluate((el) => el.scrollTo(0, 0)).catch(() => {});
    fs.writeFileSync(path.join(OUT, `${id}.txt`), await dialog.evaluate((el) => el.innerText));
  } else fs.writeFileSync(path.join(OUT, `${id}.txt`), await page.evaluate(() => document.body.innerText));
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${id}: "${a}" on "${b}"`);
  console.log(`PASS ${id}`);
}

/** Your moves' tab for a game, by its page (a pool's pick, else a lineup); null for a game of questions (answered on its page). */
const tabOf = (game) => (/second|buyback|mulligan/.test(game) ? "pool" : /beat/.test(game) ? null : "lineup");

// Flows: [case, { id, who (a person of the case's `also`, else the viewer), moves (open Your moves first), steps (selectors, in
// turn), scroll (a selector to bring into view before the frame) }].
const FLOWS = {
  captain: [
    { id: "captain-change", moves: true, steps: ['[data-captain][aria-checked="false"]'] },
    { id: "captain-none", moves: true, steps: ['[data-captain][aria-checked="true"]'] },
  ],
  bot: [{ id: "bot-bo", steps: ['[data-door-person]:not([data-player="Ann"]) >> nth=0'], sheet: true }],
  pool: [
    { id: "pool-buyback-ep1", game: "buyback", steps: ["[data-door-you]", '[role="dialog"] [data-strip-ep="1"], [data-strip-ep="1"] >> nth=-1'], sheet: true },
    { id: "pool-mulligan-ep1", game: "mulligan", steps: ["[data-door-you]", '[data-strip-ep="1"] >> nth=-1'], sheet: true },
  ],
  second: [{ id: "second-both", moves: true, steps: ["[data-pick]:not([disabled]) >> nth=1", "[data-pick]:not([disabled]) >> nth=3"] }],
  slots: [
    { id: "slots-bo-page", who: "bo" },
    { id: "slots-bo-open", who: "bo", moves: true, steps: ["[data-slot-row] button"], scroll: "[data-slot-groups]" },
  ],
};

async function shoot(c, id, go, user, s) {
  if (ONLY && !new RegExp(ONLY).test(id)) return 0;
  const b = await open({ user, pass: fixture.PASSWORD, width: W, height: H, motion: "reduce" });
  try {
    const q = [QS, s.moves ? `moves=${tabOf(s.game)}&game=${c.games[s.game]}` : ""].filter(Boolean).join("&");
    await b.page.goto(b.BASE + go + (q ? `?${q}` : ""), { waitUntil: "networkidle", timeout: 90000 });
    await b.page.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
    await sleep(1500);
    if (s.moves) await b.page.locator("[data-sheet-handle]").first().waitFor({ timeout: 15000 }).catch(() => console.log(`(no sheet in ${id})`));
    for (const t of s.steps ?? []) {
      const el = b.page.locator(t).first();
      if (!(await el.count())) {
        console.log(`(skip ${id}: no ${t})`);
        return 0;
      }
      await el.click();
      await sleep(900);
    }
    if (s.scroll) await b.page.locator(s.scroll).first().scrollIntoViewIfNeeded().catch(() => {});
    await frame(b.page, id, s.moves || s.sheet);
    if (b.errors.length) console.log(`ERRORS ${id}: ${b.errors.slice(0, 3).join(" | ")}`);
    return 0;
  } catch (e) {
    console.log(`FAIL ${id}: ${e.message.split("\n")[0]}`);
    await b.page.screenshot({ path: path.join(OUT, `${id}.fail.jpg`), type: "jpeg" }).catch(() => {});
    return 1;
  } finally {
    await b.close();
  }
}

async function main() {
  if (!fs.existsSync(fixture.FILE)) throw new Error("Bring the cases up first: node scripts/dev-test/play-pieces-fixture.js up");
  const made = JSON.parse(fs.readFileSync(fixture.FILE, "utf8"));
  let failed = 0;
  for (const [name, c] of Object.entries(made)) {
    const many = Object.keys(c.pages).length > 1;
    for (const [game, go] of Object.entries(c.pages)) {
      const base = `${name}${many ? `-${game}` : ""}`;
      failed += await shoot(c, `${base}-page`, go, c.user, { game });
      if (tabOf(game)) failed += await shoot(c, `${base}-move`, go, c.user, { game, moves: true });
      failed += await shoot(c, `${base}-you`, go, c.user, { game, steps: ["[data-door-you]"], sheet: true });
      for (const f of (FLOWS[name] ?? []).filter((f) => !f.game || f.game === game)) failed += await shoot(c, f.id, go, f.who ? c.also?.[f.who] : c.user, { game, ...f });
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
