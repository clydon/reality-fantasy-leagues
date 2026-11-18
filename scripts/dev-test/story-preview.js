// Dev-only: frames of the game preview's story mock (src/new/preview/story.tsx at /start/preview-story, development only) for a
// design round's screenshot story. Each card of the first made-up season, the merge card with its fix on, and a shuffled season's
// first and merge cards, at a phone's size, with each frame's words and any words that sit on other words (overlaps.js).
//
// Needs: the lane's dev server (BASE, default http://localhost:3014) and the story's data
// (node scripts/dev-test/preview-story-data.js). Signs in as nobody: the page reads no account.
//   node scripts/dev-test/story-preview.js [--out=.ui-atlas/stories/game-preview/story] [--width=390 --height=844]
const fs = require("fs");
const path = require("path");
process.env.BASE = process.env.BASE || "http://localhost:3014";
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/game-preview/story"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const FRAMES = [
  ...[1, 2, 3, 4, 5, 6].map((card) => ({ id: `s1-card${card}`, q: `card=${card}&season=1` })),
  { id: "s1-card5-fix", q: "card=5&season=1&fix=1" },
  { id: "s2-card1", q: "card=1&season=2" },
  { id: "s2-card5", q: "card=5&season=2" },
  { id: "s3-card4", q: "card=4&season=3" },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await open({ width: W, height: H, motion: "reduce" });
  const index = [];
  try {
    await b.page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }));
    for (const f of FRAMES) {
      await b.page.goto(`${process.env.BASE}/start/preview-story?${f.q}`, { waitUntil: "domcontentloaded" });
      await b.page.locator("[data-card-body]").first().waitFor({ timeout: 60000 });
      await b.page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 15000 }).catch(() => {});
      await b.page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
      await b.page.waitForTimeout(900);
      await b.page.screenshot({ path: path.join(OUT, f.id + ".png") });
      const text = await b.page.evaluate(() => document.querySelector("[data-preview-story]")?.innerText || "");
      fs.writeFileSync(path.join(OUT, f.id + ".txt"), text);
      const over = await overlapsIn(b.page).catch(() => []);
      const scroll = await b.page.evaluate(() => { const el = document.querySelector("[data-card-body]"); return el ? el.scrollHeight - el.clientHeight : 0; });
      for (const o of over) console.log("OVERLAP", f.id, JSON.stringify(o).slice(0, 200));
      index.push({ id: f.id, q: f.q, overlaps: over, scrollsBy: scroll });
      console.log("frame", f.id, scroll > 2 ? `(scrolls ${scroll}px)` : "");
    }
  } finally {
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ base: process.env.BASE, width: W, height: H, frames: index, errors: b.errors }, null, 1));
    if (b.errors.length) console.log("ERRORS", b.errors.slice(0, 5));
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
