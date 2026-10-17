// Dev-only test bank: bottom sheets close with a swipe down (docs/PLAN-league-tabs.md, build step 5). Needs npm run dev.
//
//   node scripts/dev-test/check-sheet-swipe.js <outDir> [width] [--dark] [--keep]
//
// Brings linked-fixture.js up (all zt-*), signs in as its zt_tester at a phone width, and with real touch events
// (CDP) checks the More sheet and the league menu (a BottomSheet): a short pull springs back and the sheet stays
// open; a long pull closes; a quick flick closes; a pull from inside a scrolled sheet just scrolls. Prints PASS/FAIL
// per check and writes <outDir>/sheet-<name>-mid.png (held mid-drag, scrim fading). Takes the fixture down at the
// end unless --keep (which deletes zt_tester: re-seed view-as.js's account after).
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-sheet-swipe.js <outDir> [width] [--dark] [--keep]");
  const dark = flags.includes("--dark");
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let fails = 0;
  const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) fails++; };
  try {
    const [classic] = await fixture.up(pool, { groupName: null });
    const { LATEST_RELEASE_ID } = require("jiti")(__filename)("../../src/lib/whats-new.ts");
    await pool.query(
      `INSERT INTO user_settings (user_id, whats_new_seen) SELECT id, $2 FROM "user" WHERE username=$1
       ON CONFLICT (user_id) DO UPDATE SET whats_new_seen = $2`, [fixture.USERNAME, LATEST_RELEASE_ID]);
    const { page, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width: parseInt(w, 10) });
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, dark ? "dark" : "light");
    await page.goto(`${BASE}/?league=${classic.leagueId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const cdp = await page.context().newCDPSession(page);
    // `at` (ms) stamps the event itself, so a flick's speed doesn't depend on how fast this script runs.
    const touch = (type, x, y, at) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }], timestamp: at / 1000 });
    // Drag from (x,y) down by dy over `ms`, optionally holding at the end for a capture, then release.
    async function pull(x, y, dy, ms, shot) {
      const t0 = Date.now();
      await touch("touchStart", x, y, t0);
      const n = 8;
      for (let i = 1; i <= n; i++) { await touch("touchMove", x, y + (dy * i) / n, t0 + (ms * i) / n); if (ms > 100) await page.waitForTimeout(ms / n); }
      if (shot) await page.screenshot({ path: `${out}/sheet-${shot}-mid.png` });
      await touch("touchEnd", 0, 0, t0 + ms);
      await page.waitForTimeout(600);
    }
    const handleOf = (sel) => page.locator(`${sel} [data-sheet-handle]`).first();
    async function handlePoint(sel) {
      const b = await handleOf(sel).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }

    for (const [name, openIt, sel] of [
      ["more", async () => page.locator("nav button", { hasText: "More" }).first().click(), "div:has(> [data-sheet-handle])"],
      ["league-menu", async () => page.locator("header [data-tour=header-league]").first().click(), "[role=dialog]"],
    ]) {
      await openIt();
      await page.waitForTimeout(500);
      const top = async () => (await page.locator(sel).count()) ? (await page.locator(sel).first().boundingBox({ timeout: 1000 }).catch(() => null))?.y ?? 9999 : 9999;
      const open0 = await top();
      let p = await handlePoint(sel);
      await pull(p.x, p.y, 40, 300);
      check(`${name}: a short pull springs back`, Math.abs((await top()) - open0) < 2);
      p = await handlePoint(sel);
      await pull(p.x, p.y, 200, 400, name);
      check(`${name}: a long pull closes`, (await top()) > open0 + 100);
      await openIt();
      await page.waitForTimeout(500);
      p = await handlePoint(sel);
      await pull(p.x, p.y, 60, 80);
      check(`${name}: a quick flick closes`, (await top()) > open0 + 100);
      await page.waitForTimeout(300);
      check(`${name}: nothing is left covering the page`, await page.evaluate(() => !document.querySelector("div.fixed.inset-0.pointer-events-auto")));
    }
    if (errors.length) console.log("page errors:", errors);
    await close();
  } finally {
    if (!flags.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  process.exit(fails ? 1 : 0);
})();
