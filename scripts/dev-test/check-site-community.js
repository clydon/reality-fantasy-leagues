// Clicks through community results in the full-site mock (.impeccable/mocks/site/community.js), no dev server,
// login or DB needed:
//   D. disputes: Episode 3's "Something wrong?" → who (Brady) → which result (Found an idol) → why → Send; the
//      Cast tab's castaway story flags an episode and marks the latest one "1 source"
//   R. a correction: a line in Episodes, a plate on Episode 3, Brady's score drops; Backstage › Results keeps the
//      old result as a house ruling (preview, then the ruling shows to players), and Who can fill them in
//   F. a player (not a commissioner) gets the quiet "Fill it in" after early results
//   A. admin: the profile menu's Admin row → Inbox → a disputed fact → decide → canonical (and the correction
//      reaches leagues) → Find narrows → an entity → Override → Lock; a stranded couch handed off leaves the Inbox
// Asserts each step, screenshots every step, and fails on any page error.
//
//   node scripts/dev-test/check-site-community.js <outDir> [--width=390]
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: check-site-community.js <outDir> [--width=390]");
  const width = +((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href;
  let n = 0, fails = 0;
  const shot = async (name) => { const f = path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`); await page.waitForTimeout(450); await page.screenshot({ path: f }); console.log("wrote", f); };
  const fail = (m) => { fails++; console.log("FAIL: " + m); };
  const expectHash = async (want) => { const h = await page.evaluate(() => location.hash); if (h !== want) fail(`at ${h}, wanted ${want}`); };
  const expectText = async (sel, text) => { const t = await page.locator(sel).first().textContent().catch(() => ""); if (!t.toLowerCase().includes(text.toLowerCase())) fail(`${sel} lacks "${text}" (has "${t.slice(0, 90)}")`); };
  const fresh = async (q, hash) => { await page.goto("about:blank"); await page.goto(base + "?n=4&motion=off&frame=1" + q + hash, { waitUntil: "networkidle" }); await page.waitForTimeout(800); };
  const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(350); };

  // D. disputes
  await fresh("&wd=none", "#/show/surv/episodes");
  await tap('[data-ep="3"]');
  await tap("#epWrong");
  await expectText("#sheet", "Something wrong in Episode 3");
  await tap('#sheet [data-dw="Brady"]');
  await tap('#sheet [data-df="idolFound"]');
  if (!(await page.locator("#dSend[disabled]").count())) fail("dispute: Send should wait for a reason");
  await tap('#sheet [data-dr="no"]');
  await shot("dispute-why");
  await tap("#dSend");
  await expectText("#toast", "flagged this too");
  await page.evaluate(() => disputeSheet(3, "Brady"));
  await page.waitForTimeout(400);
  if (!(await page.locator('#sheet [data-df="idolFound"][disabled]').count())) fail("dispute: a flagged result should read as flagged");
  await fresh("&wd=none", "#/show/surv/cast");
  await page.evaluate(() => exProfile(SHOWS.find((s) => s.id === "surv"), S51C("Brady").name));
  await page.waitForTimeout(400);
  if (!(await page.locator("#sheet .exflag").count())) fail("Cast story: no flag on episodes");
  if (!(await page.locator("#sheet .src1").count())) fail('Cast story: the latest episode should say "1 source"');
  await tap("#sheet .exflag");
  await expectText("#sheet", "Which result is wrong");

  // R. a correction, and a house ruling
  await fresh("&wd=corr", "#/show/surv/episodes");
  await expectText("[data-corr]", "Episode 3 corrected");
  await tap("[data-corr]");
  await expectText("#page .corr", "Brady's idol removed");
  const brady = await page.locator('#page .srow:has-text("Brady") .t').textContent();
  if (brady.trim() !== "+2.5") fail(`corrected: Brady's Episode 3 should be +2.5, is ${brady}`);
  await shot("correction");
  await fresh("&wd=corr", "#/show/surv/backstage/results");
  await expectText(".corr.bs", "Applied");
  await tap("#keepOld");
  await expectText("#sheet", "house ruling");
  await tap("#pvgo");
  await expectText(".corr.bs", "House ruling");
  await tap("#whoFill");
  await tap('#sheet [data-any="false"]');
  await expectText("#whoFill", "Only you and riley");
  await shot("backstage-results");
  await page.evaluate(() => { location.hash = "#/show/surv/episodes"; });
  await page.waitForTimeout(500);
  await expectText("[data-corr]", "house ruling");
  await tap("[data-corr]");
  await expectText("#page .ruling", "House ruling (alex)");

  // R2. the commissioner stays spoiler-safe: Quick check's find is hidden until they choose to look
  await fresh("&wd=none", "#/show/surv/backstage/results");
  if ((await page.locator(".qcheck").textContent()).includes("Thien")) fail("Backstage › Results shows who went home before the commissioner chose to look");
  await expectText("#qConfirm", "Confirm without looking");
  await tap("#rShow");
  await expectText(".qcheck", "Thien");
  await fresh("&wd=none", "#/show/surv/tonight");
  await page.evaluate(() => { SHOWSTATE.phase = "after"; SHOWSTATE.res = "waiting"; route(); });
  await page.waitForTimeout(400);
  await expectText('[data-job="results"]', "confirm without looking");

  // F. a player can fill in full scores, quietly
  await fresh("&wd=none", "#/show/surv/tonight");
  await page.evaluate(() => { delete SHOWSTATE.roles.alex; SHOWSTATE.phase = "after"; SHOWSTATE.res = "early"; route(); });
  await page.waitForTimeout(500);
  await expectText("#fillQ", "Full scores need one paste");
  await shot("fill-it-in");

  // A. admin
  await fresh("&wd=none", "#/hub");
  await tap("#meBtn");
  await expectText("#admRow", "need");
  await tap("#admRow");
  await page.waitForTimeout(400);
  await expectHash("#/admin/inbox");
  if ((await page.locator(".adm-item").count()) !== 4) fail("admin Inbox: wanted 4 items");
  await shot("admin-inbox");
  await tap('.adm-item[href="#/admin/fact/d1"]');
  await expectText(".adm .plate", "Disputed");
  await tap('[data-verdict="no"]');
  await tap("#pvgo");
  await expectText(".adm .plate", "Canonical");
  await expectText(".adm-done", "Locked");
  await shot("admin-decided");
  await page.evaluate(() => { location.hash = "#/admin/find"; });
  await page.waitForTimeout(500);
  await page.fill("#admQ", "couch");
  await page.waitForTimeout(200);
  const found = await page.locator("#admR .idx").count();
  if (found < 1 || found > 3) fail(`Find "couch": wanted a narrowed list, got ${found}`);
  await tap('#admR .idx[href="#/admin/e/wednesday"]');
  await tap('[data-ov="0"]');
  await expectText("#sheet", "Reaches");
  await tap("#ovSave");
  await tap("#admLock");
  await expectText("#admLock", "Locked");
  await tap('[data-act="0"]');
  await page.evaluate(() => { location.hash = "#/admin/inbox"; });
  await page.waitForTimeout(500);
  if ((await page.locator(".adm-item").count()) !== 2) fail("admin Inbox: the decided dispute and the handed-off couch should be gone");
  await shot("admin-after");
  await fresh("&wd=none", "#/show/surv/episodes");
  await page.evaluate(() => { WD.corr = true; route(); });
  await page.waitForTimeout(400);
  await expectText("[data-corr]", "Episode 3 corrected");

  await close();
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log(fails ? `${fails} failure(s)` : "all good");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
