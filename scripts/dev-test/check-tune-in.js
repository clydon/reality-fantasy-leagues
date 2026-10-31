// Dev-only check for the Tune in bumper (src/new/tune-in.tsx: the hub into a show as a TV bumper, the user's 2026-10-30 pick), in a
// real browser against the dev server, as new-fixture.js's alex. The zt show gets a poster (its card art) and a different backdrop
// (its banner), as Survivor has live, so the scanline's swap has something to swap:
//   - Up next: the bumper appears at once (the bloom, then the scanline, then the lower third naming the show), the page changes
//     under it while it holds, it holds at least 1.5 s, then folds into the show's header and leaves the real page;
//   - a card under Your shows: the same, starting from the poster;
//   - Home: the reverse, the header dropping into the show's card on the hub;
//   - a slow show (its reads held back): the bumper waits for it, and a bar runs along the plate past 1.5 s;
//   - reduced motion: the bumper still covers the load (a fade, no flight); motion off (motion.js): no bumper at all;
//   - no page errors.
// Screenshots of the beats go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-tune-in.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database. It shares
// the zt_nd_ fixture with the other check-new-* checks, so never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-tune-in runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-tune-in.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    await pool.query(
      `UPDATE shows SET art_url = '/mock/showcase/art/amazing-race.jpg', backdrop_url = '/mock/showcase/art/amazing-race-left.jpg' WHERE slug = 'zt-nd-survivor'`
    );
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex]);
    const hideBadge = () =>
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    const missing = [];
    const session = async (motion) => {
      const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844, motion });
      closers.push(b.close);
      // A failed load names its address (the console only says "404").
      b.page.on("response", (r) => r.status() >= 400 && missing.push(`${r.status()} ${new URL(r.url()).pathname}`));
      await b.page.context().addInitScript(hideBadge);
      await b.page.context().addInitScript(() => {
        window.__folds = [];
        new MutationObserver((list) => {
          for (const m of list) {
            const el = m.target;
            if (m.type === "attributes" && m.attributeName === "data-fold" && el.dataset) window.__folds.push({ at: Number(el.dataset.fold), why: el.dataset.why });
          }
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-fold"] });
      });
      return b;
    };
    const hub = async (page, BASE) => {
      await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
      await page.locator("[data-upnext]").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);
    };
    const bumper = (page) => page.locator("[data-tune-in]");

    // ---- Up next, once to warm the dev server (its first visit compiles the show's route; it may hold to the 4 s cap) ----
    const { page, BASE, errors } = await session("on");
    await hub(page, BASE);
    await page.locator("[data-upnext] [data-upnext-open]").click();
    await bumper(page).waitFor({ timeout: 2000 });
    await page.waitForURL(`**/show/${sid}/tonight`, { timeout: 8000 });
    await bumper(page).waitFor({ state: "detached", timeout: 8000 });
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Home" }).click();
    await page.waitForURL("**/home", { timeout: 4000 });
    await bumper(page).waitFor({ state: "detached", timeout: 3000 });

    // ---- Up next, as it plays ----
    await hub(page, BASE);
    const t0 = Date.now();
    await page.locator("[data-upnext] [data-upnext-open]").click();
    await bumper(page).waitFor({ timeout: 2000 });
    check(Date.now() - t0 < 600, "Up next: the bumper appears at once", `${Date.now() - t0} ms`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, "1-bloom.png") });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(out, "2-scanline.png") });
    await page.waitForTimeout(500);
    const third = (await bumper(page).innerText()).toLowerCase();
    check(third.includes("survivor") && third.includes("season 51"), "the lower third names the show and its season", third.replace(/\s+/g, " "));
    await page.screenshot({ path: path.join(out, "3-lower-third.png") });
    await page.waitForURL(`**/show/${sid}/tonight`, { timeout: 3000 });
    check((await bumper(page).count()) === 1, "the show opens under the bumper while it holds", `${Date.now() - t0} ms`);
    await bumper(page).waitFor({ state: "detached", timeout: 6000 });
    const fold = (await page.evaluate(() => window.__folds)).at(-1);
    check(!!fold && fold.at >= 1490 && fold.why === "ready", "it held at least 1.5 s, then folded once the show was in", JSON.stringify(fold));
    await page.waitForTimeout(500);
    check(await page.getByRole("heading", { level: 1 }).first().isVisible(), "the show's header is there under it");
    await page.screenshot({ path: path.join(out, "4-landed.png") });

    // ---- Home: the reverse ----
    const t1 = Date.now();
    await page.getByRole("button", { name: "Home" }).click();
    await page.locator('[data-tune-in="back"]').waitFor({ timeout: 2000 });
    check(true, "Home: the header drops back toward the hub");
    await page.waitForURL("**/home", { timeout: 4000 });
    await bumper(page).waitFor({ state: "detached", timeout: 3000 });
    check(Date.now() - t1 < 2000, "back is quick, no hold", `${Date.now() - t1} ms`);
    await page.locator("[data-upnext]").waitFor();
    await page.screenshot({ path: path.join(out, "5-back-home.png") });

    // ---- a card under Your shows, with a slow show ----
    await hub(page, BASE);
    let slow = true;
    await page.route(`**/api/seasons/${sid}/space**`, async (route) => {
      if (slow) await new Promise((r) => setTimeout(r, 2200));
      await route.continue();
    });
    await page.locator(`[data-poster="${sid}"] a[href="/show/${sid}/tonight"]:has([data-art])`).first().click();
    await bumper(page).waitFor({ timeout: 2000 });
    await page.waitForTimeout(1900);
    check((await bumper(page).count()) === 1, "a slow show: the bumper keeps holding past 1.5 s");
    const bar = await page.locator("[data-tune-bar]").evaluate((e) => Number(getComputedStyle(e).opacity));
    check(bar > 0.5, "and a bar runs along the plate while it waits", String(bar));
    await page.screenshot({ path: path.join(out, "6-slow-hold.png") });
    await bumper(page).waitFor({ state: "detached", timeout: 6000 });
    const slowFold = (await page.evaluate(() => window.__folds)).at(-1);
    check(!!slowFold && slowFold.at > 2200 && slowFold.why === "ready", "it folded once the show was in, not at the 4 s cap", JSON.stringify(slowFold));
    slow = false;
    await page.unroute(`**/api/seasons/${sid}/space**`);

    // ---- reduced motion ----
    const still = await session("reduce");
    await hub(still.page, still.BASE);
    await still.page.locator("[data-upnext] [data-upnext-open]").click();
    await bumper(still.page).waitFor({ timeout: 2000 });
    await still.page.waitForURL(`**/show/${sid}/tonight`, { timeout: 3000 });
    await bumper(still.page).waitFor({ state: "detached", timeout: 6000 });
    check(true, "reduced motion: the bumper fades up, holds and hands over");
    await still.page.getByRole("button", { name: "Home" }).click();
    await still.page.waitForURL("**/home", { timeout: 4000 });
    check((await bumper(still.page).count()) === 0, "reduced motion: back is the plain calm move, no bumper");

    // ---- motion off: no bumper ----
    const off = await session("off");
    await hub(off.page, off.BASE);
    await off.page.locator("[data-upnext] [data-upnext-open]").click();
    await off.page.waitForURL(`**/show/${sid}/tonight`, { timeout: 4000 });
    check((await bumper(off.page).count()) === 0, "motion off (checks): straight into the show, no bumper");

    const real = [...errors, ...still.errors, ...off.errors].filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]|favicon\.ico/.test(e));
    check(real.length === 0, "no page errors", [...real.slice(0, 3), ...missing.slice(0, 5)].join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers.reverse()) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
