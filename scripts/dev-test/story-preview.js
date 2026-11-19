// Dev-only: frames of the game previews' stories and their sheet (src/new/preview/story.tsx at /start/preview-story, sheet.tsx at
// /start/preview-story/sheet, development only) for a design round's screenshot story. For each preview the bench made into
// .ui-atlas/previews: each moment's card on the screen it opens on, and each card on a screen with an app bug; one real screen at
// full size; then the sheet at a desk's width, as each story and with every phone at the same moment. Each frame's words, and any
// words that sit on other words (overlaps.js), go beside it.
//
// Needs: the lane's dev server (BASE, default http://localhost:3014) and the previews (scripts/dev-test/preview-games.js, or the
// bench's `preview`). Signs in as nobody: the pages read no account.
//   node scripts/dev-test/story-preview.js [--out=.ui-atlas/stories/game-preview/story] [--width=390 --height=844] [--sheet-width=1440]
const fs = require("fs");
const path = require("path");
process.env.BASE = process.env.BASE || "http://localhost:3014";
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/game-preview/story"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844)), SW = Number(opt("sheet-width", 1440));
const DIR = path.resolve(".ui-atlas/previews");

const previews = fs.readdirSync(DIR).filter((id) => fs.existsSync(path.join(DIR, id, "preview.json"))).sort();
const FRAMES = [];
for (const id of previews) {
  const p = JSON.parse(fs.readFileSync(path.join(DIR, id, "preview.json"), "utf8"));
  p.moments.forEach((m, i) => {
    FRAMES.push({ id: `${id}-${i + 1}-${m.kind}`, q: `preview=${id}&card=${i + 1}` });
    m.screens.forEach((s, j) => { if (s.bugs.length && (j > 0 || m.screens.every((x) => x.bugs.length))) FRAMES.push({ id: `${id}-${i + 1}-${m.kind}-${s.id}`, q: `preview=${id}&card=${i + 1}&screen=${j + 1}` }); });
  });
}
const week = previews.find((id) => id.startsWith("fantasy"));
if (week) FRAMES.push({ id: `${week}-full`, q: `preview=${week}&moment=week&screen=2&full=1` });

const shot = async (page, f, sel) => {
  await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, f.id + ".png") });
  const text = await page.evaluate((s) => document.querySelector(s)?.innerText || "", sel);
  fs.writeFileSync(path.join(OUT, f.id + ".txt"), text);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  let b = await open({ width: W, height: H, motion: "reduce" });
  try {
    await b.page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }));
    for (const f of FRAMES) {
      await b.page.goto(`${process.env.BASE}/start/preview-story?${f.q}`, { waitUntil: "domcontentloaded" });
      await b.page.locator("[data-card-body], [data-missing]").first().waitFor({ timeout: 60000 });
      await shot(b.page, f, "[data-preview-story]");
      const over = await overlapsIn(b.page).catch(() => []);
      const scroll = await b.page.evaluate(() => { const el = document.querySelector("[data-card-body]"); return el ? el.scrollHeight - el.clientHeight : 0; });
      for (const o of over) console.log("OVERLAP", f.id, JSON.stringify(o).slice(0, 200));
      index.push({ id: f.id, q: f.q, overlaps: over, scrollsBy: scroll });
      console.log("frame", f.id, scroll > 2 ? `(scrolls ${scroll}px)` : "");
    }
    // The sheet, at a desk's width: each story, then every phone at the same moment.
    await b.close();
    b = await open({ width: SW, height: 1100, motion: "reduce" });
    await b.page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }));
    for (const [id, moment] of [["sheet-stories", null], ["sheet-week", "week"], ["sheet-finale", "finale"]]) {
      await b.page.goto(`${process.env.BASE}/start/preview-story/sheet`, { waitUntil: "domcontentloaded" });
      await b.page.locator("[data-preview-sheet]").waitFor({ timeout: 60000 });
      await b.page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      if (moment) {
        // Clicked once the page is live (a click before hydration does nothing), until the moment shows as chosen.
        for (let k = 0; k < 10; k++) {
          await b.page.locator(`[data-sheet-moment="${moment}"]`).click();
          if ((await b.page.locator(`[data-sheet-moment="${moment}"]`).getAttribute("aria-checked")) === "true") break;
          await b.page.waitForTimeout(500);
        }
      }
      await b.page.waitForTimeout(4000);
      await shot(b.page, { id }, "[data-preview-sheet]");
      index.push({ id, q: moment ? `sheet&moment=${moment}` : "sheet" });
      console.log("frame", id);
    }
  } finally {
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ base: process.env.BASE, width: W, height: H, frames: index, errors: b.errors }, null, 1));
    if (b.errors.length) console.log("ERRORS", b.errors.slice(0, 5));
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
