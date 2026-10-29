// Dev-only check that the phone's back closes a bottom sheet (src/new/ui/sheet-history.ts, every src/new/ui/sheet.tsx sheet), in a
// real browser against the dev server, as new-fixture.js's alex, at --width (390 by default). The browser's back stands in
// for the phone's (page.goBack()):
//   - Settings' How each game works: back closes it and the page stays; back again leaves Settings (for the hub, where it
//     came from); no back reloads the page;
//   - closed by its button, by Escape, by a tap outside: back then leaves the page (no dead back press);
//   - one sheet for another (the couch's sheet, then Rename the couch from it): back closes the one that's up and the page
//     stays; back again leaves the page;
//   - a link in a sheet (the hub's guide card for a show the couch watches, Open the show), and one that closes its sheet and goes
//     in one tap (a show's Notifications, its Settings link): it goes there, back comes to the page with no sheet up, and
//     back again goes where the hub came from (nothing left behind by the sheet);
//   - in the installed app (navigator.standalone, the first page of the visit, phone-back.tsx's floor under it): back
//     closes the sheet, then goes up to the hub.
// The app has no sheet that stays up under another (a sheet opens another by closing first), so "one at a time" is the
// one-for-another case; sheet-history.ts keeps a stack all the same.
//
//   node scripts/lane.js dev                       (in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-sheet-back.js [--width=390] [--shots=<dir>] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it: sign in as zt_nd_alex / zt-pass-12345); touches zt-nd rows
// only; refuses a non-local database. Prints PASS/FAIL per case, exits non-zero on a FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path_ = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-sheet-back runs against a local database only");

const args = process.argv.slice(2);
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const shots = (args.find((a) => a.startsWith("--shots=")) || "").slice(8) || null;
if (shots) fs.mkdirSync(shots, { recursive: true });

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const SHEET = "[role=dialog][data-open]";

(async () => {
  const pool = new Pool({ connectionString: DB });
  let close = async () => {};
  try {
    const f = await fixture.up(pool);
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, motion: "off" });
    close = b.close;
    const { BASE, errors } = b;
    const context = b.page.context();
    await b.page.close();

    const here = (page) => new URL(page.url()).pathname;
    const sheets = (page) => page.locator(SHEET).count();
    const up = (page) => page.locator(SHEET).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
    const down = (page) => page.waitForFunction((s) => !document.querySelector(s), SHEET, { timeout: 5000 }).then(() => true, () => false);
    const marked = (page) => page.evaluate(() => window.__mark === 1).catch(() => false);
    // The browser's back; a back within the page is no load, so it only waits for the history to move.
    const back = async (page) => {
      await page.goBack({ waitUntil: "commit", timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    };
    const shot = async (page, name) => shots && page.screenshot({ path: path_.join(shots, `${name}.png`) });

    async function tab({ standalone = false } = {}) {
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
      // A failed load says which (the console's own line doesn't).
      page.on("console", (m) => m.type() === "error" && !/^Failed to load resource/.test(m.text()) && errors.push(m.text()));
      page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url().replace(BASE, "")}`));
      if (standalone) await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
      return page;
    }
    // A page reached from the hub by the app's own nav, so its back goes to the hub within the page (no load).
    async function fromHub(page, path) {
      await page.goto(BASE + "/home", { waitUntil: "load" });
      await page.evaluate(() => (window.__mark = 1));
      await page.locator("main, [data-hub]").first().waitFor({ timeout: 30000 });
      await page.evaluate((p) => window.next.router.push(p), path);
      await page.waitForURL((u) => u.pathname === path, { timeout: 15000 });
    }
    const gamesRow = (page) => page.getByRole("button", { name: /How each game works/ });

    // ---------- back closes it, then leaves ----------
    {
      const page = await tab();
      await fromHub(page, "/settings");
      await gamesRow(page).waitFor({ timeout: 30000 });
      await gamesRow(page).click();
      check(await up(page), "Settings: How each game works opens");
      await shot(page, "games-open");
      await back(page);
      check((await down(page)) && here(page) === "/settings", "back closes the sheet and the page stays", here(page));
      check(await marked(page), "no reload");
      await back(page);
      check(here(page) === "/home" && (await marked(page)), "back again leaves Settings, for the hub", here(page));
      await page.close();
    }

    // ---------- closed by its button, Escape, a tap outside: no dead back press ----------
    for (const how of ["its button", "Escape", "a tap outside"]) {
      const page = await tab();
      await fromHub(page, "/settings");
      await gamesRow(page).waitFor({ timeout: 30000 });
      await gamesRow(page).click();
      await up(page);
      if (how === "its button") await page.locator(SHEET).getByRole("button", { name: "Close" }).click();
      else if (how === "Escape") await page.keyboard.press("Escape");
      else await page.mouse.click(width / 2, 30);
      check((await down(page)) && here(page) === "/settings", `closed by ${how}: the sheet goes and the page stays`, here(page));
      await page.waitForTimeout(300);
      await back(page);
      check(here(page) === "/home" && (await marked(page)), `then back leaves Settings`, here(page));
      await page.close();
    }

    // ---------- one sheet for another ----------
    {
      const page = await tab();
      await fromHub(page, "/settings");
      const couch = page.locator('[data-settings-couch="ZT Survivor 51"]');
      await couch.waitFor({ timeout: 30000 });
      await couch.click();
      await page.locator("[data-couch-details]").waitFor({ timeout: 15000 });
      await page.locator(SHEET).getByRole("button", { name: /Rename the couch/ }).click();
      await page.locator(SHEET).filter({ hasText: /Everyone on ZT Survivor 51 sees it/ }).waitFor({ timeout: 15000 });
      check((await sheets(page)) === 1, "the couch's sheet, then Rename from it: one sheet up");
      await shot(page, "rename-open");
      await back(page);
      check((await down(page)) && here(page) === "/settings", "back closes Rename and the page stays", here(page));
      await back(page);
      check(here(page) === "/home" && (await marked(page)), "back again leaves Settings (the couch's sheet left nothing behind)", here(page));
      await page.close();
    }

    // ---------- a link in a sheet ----------
    {
      const page = await tab();
      await page.goto(BASE + "/settings", { waitUntil: "load" });
      await page.goto(BASE + "/home", { waitUntil: "load" });
      await page.evaluate(() => (window.__mark = 1));
      // A show the couch plays opens the show; one it only watches opens its sheet.
      const card = page.locator(`[data-guide-card^="${f.traitorsSeasonId}:"]`).first();
      const hasCard = await card.waitFor({ timeout: 30000 }).then(() => true, () => false);
      check(hasCard, "the hub's guide has a show the couch watches");
      if (hasCard) {
        await card.click();
        await page.locator(`[data-guide-sheet="${f.traitorsSeasonId}"]`).waitFor({ timeout: 15000 });
        await page.locator(SHEET).getByRole("link", { name: "Open the show" }).click();
        await page.waitForURL((u) => u.pathname.startsWith(`/show/${f.traitorsSeasonId}`), { timeout: 15000 });
        check((await down(page)) && (await marked(page)), "Open the show goes there, no sheet, no reload", here(page));
        await back(page);
        check(here(page) === "/home" && (await sheets(page)) === 0, "back comes to the hub with no sheet up", here(page));
        await back(page);
        check(here(page) === "/settings", "back again goes where the hub came from (nothing left behind)", here(page));
      }
      await page.close();
    }

    // ---------- a link that closes its sheet and goes, in one tap ----------
    {
      const page = await tab();
      const show = `/show/${f.seasonId}/tonight`;
      await fromHub(page, show);
      const menu = page.locator("button[aria-label^='Show menu']").first();
      await menu.waitFor({ timeout: 30000 });
      await page.waitForTimeout(800);
      await menu.click();
      await page.locator(SHEET).getByRole("button", { name: /^Notifications/ }).click();
      await page.locator("[data-show-notify] [data-setting]").first().waitFor({ timeout: 15000 });
      await page.locator("[data-show-notify]").getByRole("link", { name: "Settings" }).click();
      const went = await page.waitForURL((u) => u.pathname === "/settings", { timeout: 15000 }).then(() => true, () => false);
      check(went && (await down(page)) && (await marked(page)), "the show's Notifications, its Settings link: the sheet closes and it goes there", here(page));
      await back(page);
      check(here(page) === show && (await sheets(page)) === 0, "back comes to the show with no sheet up", here(page));
      await back(page);
      check(here(page) === "/home" && (await marked(page)), "back again goes to the hub (nothing left behind)", here(page));
      await page.close();
    }

    // ---------- the installed app: the floor under the first page ----------
    {
      const page = await tab({ standalone: true });
      await page.goto(BASE + "/settings", { waitUntil: "load" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.evaluate(() => (window.__mark = 1));
      await gamesRow(page).waitFor({ timeout: 30000 });
      await gamesRow(page).tap();
      check(await up(page), "installed: the sheet opens on the first page of the visit");
      await back(page);
      check((await down(page)) && here(page) === "/settings", "installed: back closes the sheet and the page stays", here(page));
      await back(page);
      await page.waitForURL((u) => u.pathname === "/home", { timeout: 10000 }).catch(() => {});
      check(here(page) === "/home" && (await marked(page)), "installed: back again goes up to the hub", here(page));
      await page.close();
    }

    check(errors.length === 0, "no page errors", errors.join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close().catch(() => {});
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
