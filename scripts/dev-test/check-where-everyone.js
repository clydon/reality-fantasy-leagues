// Dev-only check for Where everyone is (the user's picks F and C of the 2026-11-01 mocks; src/new/couch/where.ts), in a real
// browser against the dev server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: alex, riley and jordan
// up to Episode 5, sam up to 3; riley follows the ZT Traitors openly, which alex doesn't). Here jordan turns Where I am off.
//   The hub, as alex:
//   - the couch's faces under the status line, You first, then riley, jordan and sam;
//   - riley's face: ZT Survivor 51 "Caught up · Episode 5" (yours), the ZT Traitors with "You don't watch it" and Add;
//   - jordan's (shares nothing): no shows, and the sheet says so; your own: what the couch sees of you, with the Settings link,
//     and with alex's Where I am off for a moment, that the couch sees none of it;
//   - Add on riley's Traitors closes the sheet and asks where you are (nothing is saved: the check closes it);
//   Survivor's Episodes tab:
//   - as alex (caught up): Episode 5 carries "You're here · zt_nd_riley", lifted; Episode 3 carries sam; the legend line; jordan
//     plays without sharing, said under the list; no face on an episode nobody's up to;
//   - as sam (up to 3, Episodes 4 and 5 still to reveal): Episode 5's hidden row carries alex and riley, his own row is 3;
//   - "Up to Episode", never "On Episode", anywhere on these screens; nothing wider than the screen; no page errors.
// Screenshots of each state go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-where-everyone.js <outDir> [--width=390] [--theme=night|studio] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database. Two
// checks on the zt_nd_ fixture must never run at once against one database (run each lane's on its own). Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-where-everyone runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-where-everyone.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const theme = (args.find((a) => a.startsWith("--theme=")) || "--theme=night").slice(8);
if (!["night", "studio"].includes(theme)) throw new Error("--theme is night or studio");

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
    for (const u of Object.values(fx.users)) {
      await pool.query(`INSERT INTO user_settings (user_id, ui, theme) VALUES ($1, 'new', $2) ON CONFLICT (user_id) DO UPDATE SET ui = 'new', theme = $2`, [u, theme]);
    }
    // jordan keeps where he is to himself (What your couch sees › Where I am off).
    await pool.query(`UPDATE user_settings SET share_where = false WHERE user_id = $1`, [fx.users.jordan]);

    let n = 0;
    const as = async (who) => {
      const b = await open({ user: fixture.username(who), pass: fixture.PASSWORD, width, height: 844 });
      closers.push(b.close);
      const { page, BASE, errors } = b;
      await page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
      // The home read writes this device's theme cookie (appearance.ts); one load and a reload put the page on it.
      await page.goto(`${BASE}/home`);
      await page.locator("[data-status]").waitFor({ timeout: 30_000 }).catch(() => {});
      await page.reload();
      const shot = async (name, full = false) => {
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${theme}-${width}.png`), fullPage: full });
      };
      const fits = async (where) => {
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(wide <= 0, `${who}, ${where}: nothing wider than the screen`, `${wide}px`);
      };
      const noOn = async (where) => {
        const text = await page.evaluate(() => document.body.innerText);
        check(!/\bOn Episode \d/.test(text), `${who}, ${where}: "Up to Episode", never "On Episode"`);
      };
      return { page, BASE, errors, shot, fits, noOn };
    };
    const name = (who) => fixture.username(who);

    // ---- the hub, as alex ----
    const alex = await as("alex");
    await alex.page.goto(`${alex.BASE}/home`);
    const row = alex.page.locator("[data-couch-row]");
    check(await row.waitFor({ timeout: 30_000 }).then(() => true, () => false), "alex: the couch's faces on the hub");
    const faces = await row.locator("[data-couch-face]").evaluateAll((els) => els.map((e) => e.getAttribute("data-couch-face")));
    check(JSON.stringify(faces) === JSON.stringify(["alex", "riley", "jordan", "sam"].map(name)), "You first, then everyone else on the couch", faces.join(", "));
    check((await row.locator("[data-couch-face-name]").first().textContent())?.trim() === "You", "your face says You");
    const order = await alex.page.evaluate(() => {
      const at = (sel) => [...document.querySelectorAll("main *, body *")].indexOf(document.querySelector(sel));
      return { status: at("[data-status]"), row: at("[data-couch-row]") };
    });
    check(order.status >= 0 && order.row > order.status, "under the status line");
    await alex.fits("the hub");
    await alex.shot("hub");

    const sheet = (who) => alex.page.locator(`[data-person-sheet="${name(who)}"]`);
    const showRow = (who, label) => sheet(who).locator(`[data-person-show^="${label}"]`);
    await row.locator(`[data-couch-face="${name("riley")}"]`).click();
    check(await sheet("riley").waitFor({ timeout: 15_000 }).then(() => true, () => false), "riley's face opens what riley watches");
    const surv = showRow("riley", "ZT Survivor 51");
    check((await surv.locator("[data-person-where]").textContent())?.trim() === "Caught up · Episode 5", "ZT Survivor 51: Caught up · Episode 5", await surv.textContent());
    check((await surv.locator("[data-person-add]").count()) === 0, "a show you watch has no Add");
    const traitors = showRow("riley", "ZT Traitors");
    check((await traitors.count()) === 1, "the ZT Traitors, which alex doesn't watch, is there too");
    check((await traitors.locator("[data-person-line]").textContent())?.trim() === "You don't watch it", "said as one you don't watch", await traitors.textContent());
    check((await traitors.locator("[data-person-add]").count()) === 1, "with Add");
    await alex.noOn("riley's sheet");
    await alex.fits("riley's sheet");
    await alex.shot("riley");
    await traitors.locator("[data-person-add]").click();
    check(await sheet("riley").waitFor({ state: "detached", timeout: 10_000 }).then(() => true, () => false), "Add closes the sheet");
    const where = alex.page.locator("[role=dialog][data-open]");
    check(await where.waitFor({ timeout: 10_000 }).then(() => true, () => false), "and asks where you are");
    await alex.shot("add");
    await alex.page.keyboard.press("Escape");
    await where.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});

    await row.locator(`[data-couch-face="${name("jordan")}"]`).click();
    check(await sheet("jordan").waitFor({ timeout: 15_000 }).then(() => true, () => false), "jordan's face opens too");
    check((await sheet("jordan").locator("[data-person-show]").count()) === 0 && /hasn't shared a show with the couch yet/.test((await sheet("jordan").textContent()) ?? ""), "jordan shares nothing: no shows, and the sheet says so");
    await alex.shot("jordan");
    await alex.page.keyboard.press("Escape");
    await sheet("jordan").waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});

    await row.locator(`[data-couch-face="${name("alex")}"]`).click();
    check(await sheet("alex").waitFor({ timeout: 15_000 }).then(() => true, () => false), "your own face opens your own");
    const mine = (await alex.page.locator("[role=dialog][data-open]").textContent()) ?? "";
    check(/What the couch sees of you/.test(mine) && /What your couch sees/.test(mine), "what the couch sees of you, with the way to change it", mine.slice(0, 200));
    check((await showRow("alex", "ZT Survivor 51").locator("[data-person-where]").textContent())?.trim() === "Caught up · Episode 5", "your Survivor: Caught up · Episode 5");
    await alex.shot("you");
    await alex.page.keyboard.press("Escape");
    // With his Where I am off, his own sheet says the couch sees none of it (put back after).
    await pool.query(`UPDATE user_settings SET share_where = false WHERE user_id = $1`, [fx.users.alex]);
    await alex.page.goto(`${alex.BASE}/home`);
    await row.locator(`[data-couch-face="${name("alex")}"]`).click();
    await sheet("alex").waitFor({ timeout: 15_000 }).catch(() => {});
    const hidden = (await alex.page.locator("[role=dialog][data-open]").textContent()) ?? "";
    check(/The couch sees none of this: your Where I am is off/.test(hidden) && /Only you see it: your Where I am is off/.test(hidden), "Where I am off: your own sheet says the couch sees none of it", hidden.slice(0, 200));
    await alex.shot("you-not-sharing");
    await alex.page.keyboard.press("Escape");
    await pool.query(`UPDATE user_settings SET share_where = true WHERE user_id = $1`, [fx.users.alex]);

    // ---- Survivor's Episodes tab ----
    const episodes = async (p) => {
      await p.page.goto(`${p.BASE}/show/${sid}/episodes`);
      await p.page.locator("[data-ep-who]").first().waitFor({ timeout: 30_000 });
      await p.page.waitForTimeout(600);
    };
    const whoOn = (p, sel) => p.page.locator(`${sel} [data-ep-who]`).getAttribute("data-ep-who").catch(() => null);
    await episodes(alex);
    check((await whoOn(alex, "[data-ep='5']")) === `you,${name("riley")}`, "alex: Episode 5 carries you and riley", await whoOn(alex, "[data-ep='5']"));
    check(/^You're here · zt_nd_riley$/.test(((await alex.page.locator("[data-ep='5'] [data-ep-who-line]").textContent()) ?? "").trim()), "said as You're here · zt_nd_riley");
    check(/bg-secondary/.test((await alex.page.locator("[data-ep='5']").getAttribute("class")) ?? ""), "your row is lifted");
    check((await whoOn(alex, "[data-ep='3']")) === name("sam"), "Episode 3 carries sam", await whoOn(alex, "[data-ep='3']"));
    check((await alex.page.locator("[data-ep='4'] [data-ep-who], [data-ep='1'] [data-ep-who]").count()) === 0, "no faces on an episode nobody's up to");
    check((await alex.page.locator("[data-ep-legend]").count()) === 1, "the line saying what a face marks");
    check(/zt_nd_jordan plays here but doesn't share where they are/.test((await alex.page.locator("[data-ep-quiet]").textContent().catch(() => "")) ?? ""), "jordan plays without sharing: said under the list");
    await alex.noOn("Episodes");
    await alex.fits("Episodes");
    await alex.shot("episodes-alex", true);

    const sam = await as("sam");
    await episodes(sam);
    check((await whoOn(sam, "[data-ep-hidden='5']")) === `${name("alex")},${name("riley")}`, "sam (up to 3): Episode 5, still to reveal, carries alex and riley", await whoOn(sam, "[data-ep-hidden='5']"));
    check((await whoOn(sam, "[data-ep='3']")) === "you", "and his own row is 3", await whoOn(sam, "[data-ep='3']"));
    await sam.noOn("Episodes");
    await sam.fits("Episodes");
    await sam.shot("episodes-sam", true);

    for (const p of [alex, sam]) check(p.errors.length === 0, "no page errors", p.errors.join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await fixture.down(pool).catch((e) => console.error("down:", e));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exitCode = failures ? 1 : 0;
  }
})();
