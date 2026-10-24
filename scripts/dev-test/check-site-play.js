// Checks the full-site mock's ways to play and share (.impeccable/mocks/site/gamestab.js, solo.js, share.js), no
// dev server, login or DB needed:
//   N. one name: Watch along (no "Watch it together", "Watch party" or "Together" left on the hub, Severance, Below Deck)
//   G. the Games tab: the same tabs on every show (Survivor, a show that isn't a game yet, a series; solo drops only
//      Chat), standings plus this week's games when you play, "Make it a game" when nobody does
//   S. solo: public pools and a practice couch on the solo hub; join a pool; start a practice couch
//   R. share at the reveal's peak: the card leaves out who went home until you say so, above the reveal
//   P. what the couch sees: three presets, a live preview, Customize
// Asserts each step, screenshots every step, and fails on any page error.
//
//   node scripts/dev-test/check-site-play.js <outDir> [--width=390]
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: check-site-play.js <outDir> [--width=390]");
  const width = +((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href;
  let n = 0, fails = 0;
  const shot = async (name) => { const f = path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`); await page.waitForTimeout(450); await page.screenshot({ path: f }); console.log("wrote", f); };
  const fail = (m) => { fails++; console.log("FAIL: " + m); };
  const expectText = async (sel, text) => { const t = await page.locator(sel).first().textContent().catch(() => ""); if (!t.toLowerCase().includes(text.toLowerCase())) fail(`${sel} lacks "${text}" (has "${t.slice(0, 90)}")`); };
  const fresh = async (q, hash) => { await page.goto("about:blank"); await page.goto(base + "?motion=off&frame=1" + q + hash, { waitUntil: "networkidle" }); await page.waitForTimeout(800); };
  const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(350); };
  const tabs = async () => (await page.locator(".tabbar a").allTextContents()).map((t) => t.replace(/\d+/g, "").trim());

  // N. one name
  for (const h of ["#/hub", "#/show/sev/tonight", "#/show/bd/tonight"]) {
    await fresh("&n=4", h);
    const txt = await page.locator("#app").innerText();
    const old = txt.match(/Watch it together|Watch party|Together ·|\bTOGETHER\b/i);
    if (old) fail(`${h}: still says "${old[0]}"`);
  }
  await fresh("&n=4", "#/hub");
  await expectText(".hn-now .go", "Watch along");

  // G. the Games tab
  for (const [h, want] of [["#/show/surv/tonight", 5], ["#/show/ar/tonight", 5], ["#/show/plu/tonight", 5]]) {
    await fresh("&n=4", h);
    const t = await tabs();
    if (t.length !== want || t[2] !== "Games") fail(`${h}: tabs ${JSON.stringify(t)}, wanted ${want} with Games in the middle`);
  }
  await fresh("&n=4", "#/show/surv/standings");
  if (!(await page.locator(".blk.game").count())) fail("Games (playing): no standings tables");
  await expectText("#app", "This week");
  if (!(await page.locator("[data-eg]").count())) fail("Games: no episode games");
  await shot("games-playing");
  await fresh("&n=4", "#/show/ar/standings");
  await expectText(".playplate", "Make");
  await fresh("&n=1", "#/show/surv/tonight");
  const solo = await tabs();
  if (solo.includes("Chat") || !solo.includes("Games")) fail(`solo tabs ${JSON.stringify(solo)}: wanted Games and no Chat`);

  // S. solo
  await fresh("&n=1", "#/hub");
  await expectText("#app", "Play on your own");
  if (!(await page.locator('[data-pool="surv"]').count()) || !(await page.locator("[data-practice]").count())) fail("solo hub: no public pool or practice couch");
  await shot("solo-hub");
  await tap('[data-pool="surv"]');
  await tap("#spJoin");
  await expectText("#page", "Your streak");
  await expectText("#page", "usernames only");
  await shot("public-pool");
  await page.click("#page [data-back]"); await page.waitForTimeout(350);
  await tap("[data-practice]");
  await tap('#sheet [data-pl="Sharp"]');
  await tap("#pcGo");
  await expectText("[data-practice]", "computer players");
  await fresh("&n=1", "#/show/surv/standings");
  if (!(await page.locator('#app [data-pool="surv"]').count())) fail("solo Games tab: no public pool");

  // R. share at the reveal's peak
  await fresh("&n=4", "#/show/surv/tonight");
  await page.evaluate(() => { SHOWSTATE.phase = "after"; SHOWSTATE.res = "early"; revealPlay(SHOWS[0]); });
  await page.waitForTimeout(400);
  await tap("#rskip");
  await page.waitForTimeout(500);
  await tap("#rvShare");
  if (!(await page.locator("#sheet.on .sh-card").isVisible())) fail("share: the sheet isn't showing above the reveal");
  if ((await page.locator("#sheet .sh-card").textContent()).includes("voted out")) fail("share: the card says who went home before you chose to");
  await tap("#shOut");
  await expectText("#sheet .sh-card", "voted out");
  await shot("share-card");
  await tap("#shCouch");
  await expectText("#toast", "Posted");

  // P. what the couch sees
  await fresh("&n=4", "#/account");
  await page.evaluate(() => document.getElementById("privSec").scrollIntoView());
  await tap('[data-priv="games"]');
  if ((await page.locator(".pv-line.off").count()) !== 2) fail("privacy: Just my games should hide 2 lines in the preview");
  await page.evaluate(() => { const d = document.querySelector("#privSec details"); d.open = true; });
  await tap('[data-pv="ratings"]');
  await expectText("#privSec details summary", "Your own mix");
  await shot("privacy");

  await close();
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log(fails ? `${fails} failure(s)` : "all good");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
