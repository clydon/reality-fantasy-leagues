// Clicks through waivers in the full-site mock (.impeccable/mocks/site/waivers.js), both versions, no dev server,
// login or DB needed:
//   S. simple: Tonight's "Replace Jenna" ("Open") → the page (your team, one quiet tag each) → Swap on Jenna: the
//      Cast tab's slider and dropdowns (Show a tribe, Ranked by a stat), a pick and a backup marked apart, take Devin
//      (Tonight says Set) → swap Mike for Cristian, then Keep Mike → How it works (the
//      lanes) → Episodes row → the dock's Swap row → the run → the reveal → Episodes says who; two out: two free
//      swaps to pick; nobody picked: the run falls back to most points and says so
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
  await expectText('[data-job="waivers"]', "Replace Jenna");
  await expectText('[data-job="waivers"] .st', "Open");
  await tap('[data-job="waivers"]');
  await expectHash("#/show/surv/waivers");
  await expectText(".wvs-q", "Replace Jenna");
  await expectText(".wvs-chip.req", "Replace Jenna");
  if (await page.locator(".wv-sig i.warn").count()) fail("simple: negative tags are back");
  if ((await page.locator(".wvt-b").allTextContents()).some((t) => t.trim() !== "Swap")) fail("simple: every row button should say Swap");
  if ((await page.locator(".wvt").count()) !== 5) fail("simple: wanted all 5 of your team on the page");
  if (await page.locator(".wvt-in").count()) fail("simple: nothing should be picked for you up front");
  if (await page.locator("text=/points (go|stay)|Keeps \\d/").count()) fail("simple: points copy is back");
  await expectText(".wvs-fb", "most points");
  await shot("simple-page");
  await tap('.wvt-b.free[data-d="Jenna"]');
  if (await page.locator("#sheet .wvs-r.pick").count()) fail("simple picker: nothing should be preselected");
  if (!(await page.locator("#sheet #wvFrom").count())) fail("picker: no episode slider (the Cast tab's)");
  await page.selectOption('#sheet [data-exsel="f"]', "Savu"); await page.waitForTimeout(300);
  const savu = await page.locator("#sheet [data-fa]").allTextContents();
  if (!savu.length || savu.some((t) => !/Devin|Ori/.test(t))) fail(`Show Savu: wanted only Savu free agents, got ${JSON.stringify(savu)}`);
  await page.selectOption('#sheet [data-exsel="f"]', "all"); await page.waitForTimeout(300);
  await page.selectOption('#sheet [data-exsel="st"]', { label: "Idols found" }); await page.waitForTimeout(300);
  if (!(await page.locator("#sheet .wvs-r .val small", { hasText: "time" }).count())) fail("Ranked by a stat: values should read times");
  await tap("#wvOwn");
  await tap('#sheet [data-fa="Devin"]');
  await tap('#sheet [data-fa="Sharonda"]');
  if (!(await page.locator('#sheet .wvs-r.pick[data-fa="Devin"]').count()) || !(await page.locator('#sheet .wvs-r.bk[data-fa="Sharonda"]').count())) fail("picker: pick and backup should be marked apart");
  await shot("simple-picker-backup");
  await tap('#sheet [data-fa="Sharonda"]');
  await tap("#wvOwn");
  await expectText("#wvsOk", "Devin comes in");
  await shot("simple-picker");
  await tap("#wvsOk");
  await expectText('.wvt:has-text("Jenna") .wvt-in', "Devin comes in");
  await expectText(".wvs-conf", "1 swap in");
  await go("#/show/surv/tonight");
  await expectText('[data-job="waivers"] .st', "Set");
  await go("#/show/surv/waivers");
  await tap('.wvt-b[data-d="Mike"]');
  await tap('#sheet [data-fa="Cristian"]');
  await tap("#wvsOk");
  await expectText('.wvt:has-text("Mike") .wvt-in', "Cristian comes in");
  if (!(await page.locator('.wvt-b[data-d="Kristin"][disabled]').count())) fail("simple: with the 1 swap used, other Swap buttons should be off");
  await shot("simple-swap");
  await tap('.wvt:has-text("Mike") .wvt-in');
  await tap("#wvsNo");
  if (await page.locator('.wvt:has-text("Mike") .wvt-in').count()) fail("simple: Keep Mike didn't drop the swap");
  await tap('.wvt-b[data-d="Mike"]');
  await tap('#sheet [data-fa="Cristian"]');
  await tap("#wvsOk");
  await tap('[data-wvs="how"]');
  if (!(await page.locator("#sheet .wv-lanes .wv-lane i.on").count())) fail("How it works: no open lane cells");
  await shot("how-it-works");
  await page.keyboard.press("Escape");
  await go("#/show/surv/episodes");
  await expectText(".wv-ep", "Due ");
  await go("#/show/surv/tonight");
  await tap("#dock");
  await tap('#sheet [data-seg="lineup"]');
  await expectText("#toWaivers", "Replace Jenna");
  await tap("#toWaivers");
  await page.waitForTimeout(400);
  await expectHash("#/show/surv/waivers");
  await page.evaluate(() => { wvDoRun(); location.hash = "#/show/surv/tonight"; });
  await page.waitForTimeout(500);
  await tap('[data-job="wvreveal"]');
  if (!(await page.locator(".revealfs").count())) fail("the run: no reveal");
  for (let i = 0; i < 6; i++) await tap("#rstage");
  await shot("reveal-last");
  await tap("#rvd");
  if (await page.locator('[data-job="wvreveal"]').count()) fail("the run: Waivers ran plate still there after the reveal");
  await go("#/show/surv/episodes");
  await expectText(".wv-ep", "You got Devin for Jenna");
  await tap("[data-wvep]");
  await expectText("#page", "sam got Sharonda for Aaliyah");
  await shot("run-page");
  await fresh("&waivers=simple&wv=two", "#/show/surv/waivers");
  if ((await page.locator(".wvt-b.free").count()) !== 2) fail("two out: wanted two yellow Swap buttons");
  await expectText(".wvs-q", "Replace Patt and Jenna");
  await shot("simple-two-out");
  await fresh("&waivers=simple&wv=two-ran", "#/show/surv/waivers");
  if ((await page.locator(".wvs-card.got").count()) !== 2) fail("two out, nobody picked: wanted both spots filled by the fallback");
  await expectText(".wvs .wvs-why", "No pick in");

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
    if (ver === "simple") { await tap('#sheet [data-wp="all"]'); if (await page.locator("#sheet .plate").count()) fail("simple open window: no Players get preview"); await expectText("#sheet", "notification"); }
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
