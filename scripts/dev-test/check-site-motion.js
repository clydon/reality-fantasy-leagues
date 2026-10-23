// Checks the full-site mock's navigation motion (.impeccable/mocks/site/nav.js + nav.css), no server or login:
// each kind of move fires the right transition (channel change, tabs sideways, push / pop by depth, the explorer's
// re-sort), lands on the right screen, restores the hub's scroll on the way back, and calms down under reduced
// motion. Also fails if a navigation keyframe animates anything but transform or opacity (DESIGN.md → Motion).
// Writes mid-flight frames and a contact sheet to <outDir>.
//
//   node scripts/dev-test/check-site-motion.js <outDir>
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const out = process.argv[2];
  if (!out) throw new Error("usage: check-site-motion.js <outDir>");
  fs.mkdirSync(out, { recursive: true });
  let fails = 0;
  const fail = (m) => { fails++; console.log("FAIL: " + m); };
  // the keyframes: transform and opacity only
  const css = fs.readFileSync(".impeccable/mocks/site/nav.css", "utf8");
  for (const [, name, body] of css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)) {
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => !["transform", "opacity"].includes(p));
    if (props.length) fail(`@keyframes ${name} animates ${props.join(", ")}`);
  }
  const { page, close } = await open({ width: 390, height: 844 });
  const errors = [], frames = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href;
  // start a move, catch which transition it is and a frame mid-flight, then let it land
  const move = async (label, act, want) => {
    await page.evaluate(() => { window.__nav = []; new MutationObserver(() => { const n = document.documentElement.dataset.nav; if (n) window.__nav.push(n); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-nav"] }); });
    await act();
    await page.waitForTimeout(110);
    const f = path.join(out, `${String(frames.length + 1).padStart(2, "0")}-${label}.png`);
    await page.screenshot({ path: f }); frames.push(f);
    await page.waitForTimeout(600);
    const seen = await page.evaluate(() => window.__nav);
    if (!seen.includes(want)) fail(`${label}: wanted a "${want}" transition, saw ${JSON.stringify(seen)}`);
    if (await page.evaluate(() => !!document.documentElement.dataset.nav)) fail(`${label}: the transition never finished`);
  };
  await page.goto(base + "?n=4#/hub", { waitUntil: "networkidle" });
  await page.addStyleTag({ content: ".mockfab{display:none!important}" });
  await page.waitForTimeout(800);
  await page.locator('[data-poster="surv"] .face.front').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const leftAt = await page.evaluate(() => document.getElementById("scroller").scrollTop);
  await move("channel-in", () => page.locator('[data-poster="surv"] .face.front').click(), "channel");
  if (!(await page.evaluate(() => location.hash)).includes("/show/surv/tonight")) fail("channel-in: didn't land on Survivor");
  await move("tab-right", () => page.click('.tabbar a[href$="/cast"]'), "left");
  if (!(await page.locator(".tab-ind").count())) fail("tabs: no sliding tab marker");
  await move("tab-left", () => page.click('.tabbar a[href$="/tonight"]'), "right");
  await move("explorer-sort", async () => { await page.click('.tabbar a[href$="/cast"]'); await page.waitForTimeout(700); await page.click("[data-exv=rank]"); }, "flip");
  await move("push-backstage", () => page.evaluate(() => { location.hash = "#/show/surv/backstage"; }), "push");
  await move("pop-show", () => page.evaluate(() => history.back()), "pop");
  await page.evaluate(() => { location.hash = "#/show/surv/tonight"; }); await page.waitForTimeout(800);
  await move("channel-out", () => page.click(".sbar .back"), "channel");
  const y = await page.evaluate(() => document.getElementById("scroller").scrollTop);
  if (Math.abs(y - leftAt) > 4) fail(`back to the hub: scroll is ${y}, wanted ${leftAt} (where you left it)`);
  await move("first-run", async () => { await page.evaluate(() => { location.hash = "#/start/1"; }); await page.waitForTimeout(700); await page.click("#fnext"); }, "push");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "?n=4#/hub", { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  await move("reduced", () => page.evaluate(() => { location.hash = "#/show/surv/tonight"; }), "calm");
  await close();
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  const sharp = require("sharp");
  const imgs = await Promise.all(frames.map((f) => sharp(f).resize(390, 844).toBuffer()));
  await sharp({ create: { width: 398 * imgs.length, height: 844, channels: 3, background: "#000" } })
    .composite(imgs.map((b, i) => ({ input: b, left: i * 398, top: 0 }))).jpeg({ quality: 70 }).toFile(path.join(out, "sheet.jpg"));
  console.log("wrote", path.join(out, "sheet.jpg"));
  console.log(fails ? `${fails} failure(s)` : "all good");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
