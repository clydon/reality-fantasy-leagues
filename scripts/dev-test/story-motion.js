// Dev-only: a design's motion, filmed at a phone's size for a screenshot story (stills are shot with reduced motion, so a crawl
// or a drift never shows in them). Records a flow as a .webm with motion on, as the user sees it.
//
//   hub-guide (default): the hub (Bands: hub/bands.tsx), then On TV into the guide (today's rundown arriving),
//                        a swipe to each of the next two days, a tap back to today, and back to the hub.
//
// Needs: the app on :3000 (npm run dev; BASE= for another) and the zt_nd couch up (census-app.js --up). Reads only.
// Run:   node scripts/dev-test/story-motion.js --out=.ui-atlas/stories/<design>/video [--who=alex] [--flow=hub-guide]
//          [--width=390 --height=844]
// Writes <out>/<flow>.webm.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { open, BASE } = require("./browser");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/motion"));
const WHO = opt("who", "alex"), FLOW = opt("flow", "hub-guide");
const W = Number(opt("width", 390)), H = Number(opt("height", 844));

const FLOWS = {
  "hub-guide": async (p) => {
    await p.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
    await p.locator("[data-on-tv]").waitFor({ timeout: 45000 });
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    // The hub holds still (the motion is the guide's).
    await p.waitForTimeout(3500);
    // A look down the bands and back.
    await p.mouse.wheel(0, 520);
    await p.waitForTimeout(2500);
    await p.mouse.wheel(0, -520);
    await p.waitForTimeout(1500);
    await p.locator("[data-on-tv-open]").click();
    await p.locator("[data-guide-page]").waitFor({ timeout: 15000 });
    // Tonight's grid arriving (its blocks settling, the Now line drawing down), then a swipe to each of the next two days and a
    // tap back to today.
    await p.waitForTimeout(3500);
    const days = p.locator("[data-guide-days]");
    for (let k = 0; k < 2; k++) {
      const box = await days.boundingBox();
      if (!box) break;
      const y = box.y + Math.min(box.height / 2, 260);
      await p.mouse.move(box.x + box.width * 0.85, y);
      await p.mouse.down();
      for (let s = 1; s <= 12; s++) await p.mouse.move(box.x + box.width * (0.85 - (0.7 * s) / 12), y, { steps: 2 });
      await p.mouse.up();
      await p.waitForTimeout(2600);
    }
    await p.locator('[data-guide-cell="0"]').click();
    await p.waitForTimeout(2600);
    await p.locator('[role="dialog"]:has([data-guide-page]) button:has-text("Home")').click();
    await p.waitForTimeout(2500);
  },
};

(async () => {
  const flow = FLOWS[FLOW];
  if (!flow) throw new Error(`no flow ${FLOW}: ${Object.keys(FLOWS).join(", ")}`);
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(OUT, `.rec-${Date.now()}`);
  const b = await open({ user: `zt_nd_${WHO}`, pass: "zt-pass-12345", width: W, height: H, motion: "on", video: tmp });
  let ok = true;
  try {
    await flow(b.page);
  } catch (e) {
    ok = false;
    console.log("FAIL", e.message.split("\n")[0]);
  }
  const video = b.page.video();
  await b.close();
  const src = video ? await video.path() : null;
  if (src && fs.existsSync(src)) {
    const dest = path.join(OUT, `${FLOW}.webm`);
    fs.renameSync(src, dest);
    console.log(`${ok ? "PASS" : "PARTIAL"} ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
})();
