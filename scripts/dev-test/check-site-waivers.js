// Clicks through waivers in the full-site mock (.impeccable/mocks/site/waivers.js), both versions, no dev server,
// login or DB needed:
//   S. simple: Tonight's waivers job → the page (Sharonda lined up) → pick Devin → swap Eric for Cristian →
//      How it works (the lanes) → Episodes row → the dock's Replace row → the run → the reveal → Episodes says who
//   V. v2 port: plate → Replace → picker (tap order, Ranked by) → Save → reorder with the grip → a swap →
//      shared league → a quiet week
//   C. commissioner, both: Open a waiver window (presets / controls), settings (feel), Run now → players see it
//   O. waivers-options.html loads every phone
// Asserts each step, screenshots every step, and fails on any page error.
//
//   node scripts/dev-test/check-site-waivers.js <outDir> [--width=390]
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: check-site-waivers.js <outDir> [--width=390]");
  const width = +((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const site = path.resolve(".impeccable/mocks/site");
  const base = pathToFileURL(path.join(site, "index.html")).href;
  let n = 0, fails = 0;
  const shot = async (name) => { const f = path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`); await page.waitForTimeout(450); await page.screenshot({ path: f }); console.log("wrote", f); };
  const fail = (m) => { fails++; console.log("FAIL: " + m); };
  const expectHash = async (want) => { const h = await page.evaluate(() => location.hash); if (h !== want) fail(`at ${h}, wanted ${want}`); };
  const expectText = async (sel, text) => { const t = await page.locator(sel).first().textContent().catch(() => ""); if (!t.toLowerCase().includes(text.toLowerCase())) fail(`${sel} lacks "${text}" (has "${t.slice(0, 90)}")`); };
  const fresh = async (q, hash) => { await page.goto("about:blank"); await page.goto(base + "?n=4&motion=off&frame=1" + q + hash, { waitUntil: "networkidle" }); await page.waitForTimeout(700); };
  const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(350); };
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(500); };

  // S. simple
  await fresh("&waivers=simple", "#/show/surv/tonight");
  await expectText('[data-job="waivers"]', "lined up for Jenna");
  await tap('[data-job="waivers"]');
  await expectHash("#/show/surv/waivers");
  await expectText(".wvs-q", "Sharonda's lined up");
  if (!(await page.locator(".wvs-line li.me").count())) fail("simple: no picking order with you in it");
  await shot("simple-page");
  await tap('button.btn[data-wvs="pick"]');
  if (!(await page.locator('#sheet [data-fa="Sharonda"].pick').count())) fail("simple picker: the lined-up pick isn't selected");
  await tap('#sheet [data-fa="Devin"]');
  await expectText("#wvsOk", "Take Devin");
  await shot("simple-picker");
  await tap("#wvsOk");
  await expectText(".wvs-q", "Devin takes Jenna's spot");
  await tap('[data-wvs="swap"]');
  await tap('#sheet [data-go="Eric"]');
  await page.waitForTimeout(300);
  await tap('#sheet [data-in="Cristian"]');
  await expectText(".blk:has([data-wvs=unswap])", "Cristian");
  await shot("simple-swap");
  await tap('[data-wvs="how"]');
  if (!(await page.locator("#sheet .wv-lanes .wv-lane i.on").count())) fail("How it works: no open lane cells");
  await shot("how-it-works");
  await page.keyboard.press("Escape");
  await go("#/show/surv/episodes");
  await expectText(".wv-ep", "Claims due");
  await go("#/show/surv/tonight");
  await tap("#dock");
  await tap('#sheet [data-seg="lineup"]');
  await tap("#toWaivers");
  await page.waitForTimeout(400);
  await expectHash("#/show/surv/waivers");
  await page.evaluate(() => { wvDoRun(); location.hash = "#/show/surv/tonight"; });
  await page.waitForTimeout(500);
  await tap('[data-job="wvreveal"]');
  if (!(await page.locator(".revealfs").count())) fail("the run: no reveal");
  for (let i = 0; i < 5; i++) await tap("#rstage");
  await shot("reveal-last");
  await tap("#rvd");
  if (await page.locator('[data-job="wvreveal"]').count()) fail("the run: Waivers ran plate still there after the reveal");
  await go("#/show/surv/episodes");
  await expectText(".wv-ep", "You got Devin for Jenna");
  await tap("[data-wvep]");
  await expectText("#page", "sam got Sharonda for Patt");
  await shot("run-page");

  // V. v2 port
  await fresh("&waivers=v2", "#/show/surv/waivers");
  await expectText(".plate .t", "Replace Jenna · Swap 1");
  await expectText(".plate .d", "3rd in line");
  await tap("a.wv-act.rep");
  await expectHash("#/show/surv/waivers/pick/Jenna");
  await tap('[data-fa="Sharonda"]');
  await tap('[data-fa="Devin"]');
  await expectText("#wvBar", "backup Devin");
  await tap("#wvRank");
  await tap("#sheet .typecard >> nth=3");
  if (!(await page.locator(".wvp-t small", { hasText: "time" }).count())) fail("v2 picker: Ranked by a stat should read times");
  await shot("v2-picker");
  await tap("#wvSave");
  await expectHash("#/show/surv/waivers");
  if ((await page.locator(".wv-cr").count()) !== 2) fail("v2: wanted 2 claim rows for Jenna");
  await tap('[data-grip="Jenna|1"]');
  await tap('#sheet [data-mv="-1"]');
  await expectText(".wv-cr b", "Devin");
  await tap('a.wv-act[href$="/pick/Eric"]');
  await tap('[data-fa="Cristian"]');
  await tap("#wvSave");
  await expectText(".wv-cr:has-text('for Eric')", "Cristian for Eric");
  await shot("v2-claims");
  await fresh("&waivers=v2&wv=shared", "#/show/surv/waivers");
  await expectText(".plate .d", "you get who you pick");
  if (await page.locator(".wv-gh").count()) fail("v2 shared: claims section shouldn't show");
  await fresh("&waivers=v2&wv=quiet", "#/show/surv/waivers");
  await expectText(".plate .t", "Nothing to do this week");

  // C. commissioner
  for (const ver of ["simple", "v2"]) {
    await fresh(`&waivers=${ver}`, "#/show/surv/backstage/waivers");
    await tap("#wvChg");
    if (ver === "simple") { await tap('#sheet [data-wp="all"]'); await expectText("#sheet .plate .t", "Swap any"); }
    else { await tap('#sheet [data-wsw="1"]'); await expectText("#sheet .plate .t", "Swap up to 2"); await tap("#wvRep"); await tap('#sheet [data-wsw="-1"]'); await tap('#sheet [data-wsw="-1"]'); if (!(await page.locator("#wvOpenGo[disabled]").count())) fail("v2 open window: nothing chosen should disable Open window"); await tap("#wvRep"); }
    await shot(`${ver}-open-window`);
    await tap("#wvOpenGo");
    await tap("#wvSet");
    await tap('#sheet [data-wfeel="casual"]');
    if (ver === "v2") await tap("#wvApply");
    await expectText("#sheet", ver === "v2" ? "Your league is on Casual" : "Replace them once you're down to 2");
    await shot(`${ver}-settings`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await tap("#runNow");
    await tap("#pvgo");
    await go("#/show/surv/waivers");
    await expectText(ver === "v2" ? ".plate .t" : ".wvs-q", ver === "v2" ? "You got" : "on your team");
  }

  // O. the comparison page
  await page.goto(pathToFileURL(path.join(site, "waivers-options.html")).href, { waitUntil: "load" });
  const frames = await page.locator("iframe").count();
  if (frames < 15) fail(`options page: ${frames} phones`);
  await page.waitForTimeout(1500);
  await shot("options");

  await close();
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log(fails ? `${fails} failure(s)` : "all good");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
