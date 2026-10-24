// Dev-only check for step 0d's hub (docs/PLAN-new-design.md), in a real browser against the dev server, as
// new-fixture.js's alex on the new design:
//   - the hub in each shape (?hub=focus, grow, new), the profile sheet, and the six More on the couch pages render,
//     and between them every hub.* entry of the Preview registry (src/new/preview.ts) shows at least once;
//   - each More page opens over the hub (?page=) and the back gesture closes it;
//   - tapping Up next grows its art into the show bar (the channel change), as the poster does in check-new-shell;
//   - nothing is wider than the screen, and no page errors.
// Screenshots of each shape (a screen at a time down the page), the sheet and every page go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-hub.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { PREVIEWS } = jiti("../../src/new/preview.ts");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-hub runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-hub.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const PAGES = ["rankings", "break", "numbers", "verdicts", "previously", "trophies"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex]);

    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    close = b.close;
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() => {
      window.__vt = [];
      const start = Document.prototype.startViewTransition;
      if (start)
        Document.prototype.startViewTransition = function (arg) {
          const entry = { nav: document.documentElement.dataset.nav || null, anims: [] };
          window.__vt.push(entry);
          const t = start.call(this, arg);
          t.ready.then(() => (entry.anims = document.documentElement.getAnimations({ subtree: true }).map((a) => a.effect?.pseudoElement || ""))).catch(() => {});
          return t;
        };
      // Next's dev badge sits over the screen's bottom-left.
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const seen = new Set();
    const collect = async () => (await page.$$eval("[data-preview]", (els) => els.map((e) => e.dataset.preview))).forEach((id) => seen.add(id));
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    // A screen at a time down the page (the document scrolls), or down a pushed page (it scrolls itself).
    async function shoot(name, scroller = null) {
      const height = await page.evaluate((s) => (s ? document.querySelector(s).scrollHeight : document.documentElement.scrollHeight), scroller);
      for (let k = 0, y = 0; y < height - 120 && k < 8; k++, y += 780) {
        await page.evaluate(([s, top]) => (s ? (document.querySelector(s).scrollTop = top) : window.scrollTo(0, top)), [scroller, y]);
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${name}-${k}.png`) });
      }
      await page.evaluate((s) => (s ? (document.querySelector(s).scrollTop = 0) : window.scrollTo(0, 0)), scroller);
    }

    // ---- the hub, in each shape ----
    for (const shape of ["focus", "grow", "new"]) {
      await page.goto(`${BASE}/home?hub=${shape}`, { waitUntil: "networkidle" });
      await page.locator(`[data-hub]`).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
      await collect();
      await fits(`hub (${shape})`);
      await shoot(`hub-${shape}`);
    }
    check(seen.has("hub.guide") && seen.has("hub.feed"), "the guide and the feed are on the hub");
    check(seen.has("hub.get-going") && seen.has("hub.grow-note"), "a new couch gets Get the couch going and what comes next");

    // ---- the profile sheet ----
    await page.goto(`${BASE}/home?hub=focus`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Your profile" }).click();
    await page.getByRole("dialog").getByText("ZT Survivor 51").first().waitFor();
    check(true, "the profile sheet names your couch");
    await collect();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, "profile.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // ---- More on the couch ----
    for (const [i, key] of PAGES.entries()) {
      const row = page.locator("section", { hasText: "More on the couch" }).getByRole("button").nth(i);
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.waitForURL(new RegExp(`page=${key}`));
      await page.waitForTimeout(600);
      const shown = await page.locator(`[data-preview="hub.${key}"]`).isVisible();
      check(shown, `More on the couch › ${key} opens over the hub`);
      await collect();
      await shoot(`more-${key}`, "[role=dialog][aria-hidden=false]");
      await page.goBack();
      await page.waitForTimeout(600);
      check(!page.url().includes("page=") && new URL(page.url()).pathname === "/home", `back closes ${key}`);
    }

    // ---- every hub entry showed somewhere ----
    const missing = Object.keys(PREVIEWS).filter((id) => id.startsWith("hub.") && !seen.has(id));
    check(missing.length === 0, "every hub.* Preview entry renders", missing.join(", "));

    // ---- Up next grows its art into the show bar ----
    await page.goto(`${BASE}/home?hub=focus`, { waitUntil: "networkidle" });
    await page.evaluate(() => (window.__vt.length = 0));
    await page.locator("[data-art-scope] h2 a").click();
    await page.waitForURL(`**/show/${sid}/tonight`);
    await page.waitForTimeout(700);
    const vt = await page.evaluate(() => window.__vt.at(-1) || null);
    check(!!vt && vt.nav === "channel" && vt.anims.some((a) => a.includes("nd-art")), "Up next: its art grows into the show bar", JSON.stringify(vt));

    const real = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    await close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
