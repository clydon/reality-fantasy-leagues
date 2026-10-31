// Dev-only check of the first-time tour (docs/PLAN-first-time-tour.md, src/new/tour/): it plays over Home once an account,
// every step lights what its step list says (the first of its targets that's on that Home; none: the screen dims around the
// lower third), the count and words are the step list's, the example plays once the light is on (a tap shows), and it's kept:
//   A. sam (results waiting, a move due), notifications allowed on this phone: all of it, step by step, to Not now; the
//      account keeps it (seen, the furthest step); Home doesn't play it again; the page doesn't scroll by hand under it.
//   B. alex, notifications as the browser has them: Skip at step 2 keeps it (step 2); not again.
//   C. alex again: Settings › Take the tour plays it on Home; Escape skips it; the furthest step stays.
//   D. sam: /home?tour=1 plays it and takes ?tour off the address.
//   E. zt_nd_solo (no couch, one show): the couch pitched (Watching solo, nothing lit for what friends watch, Start a couch),
//      no Couch points; Turn on ends it.
//   F. riley with reduced motion: each step's light at once, no taps in the examples.
//   G. zt_nd_admin acting as jordan (the desk's Act as them): Home doesn't play it, and a write is refused (kept: false).
//   H. riley in Studio: plays, with no page errors.
// Nothing wider than the screen; no page errors.
//
//   node scripts/lane.js dev                                  (the server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-new-tour.js [--width=390] [--shots=<dir>] [--keep]
//
// Brings new-fixture.js's couch up (its zt_nd_ people) and adds zt_nd_solo (on no couch, following its season) and zt_nd_admin
// (a site admin); takes them all down at the end unless --keep (new-fixture's down removes every zt_nd_ account). Refuses a
// non-local database. Don't run it beside another check on the same database: they share the zt_nd_ fixture.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { tourSteps } = jiti("../../src/new/tour/steps.ts");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const WIDTH = Number(opt("width", 390));
const SHOTS = opt("shots", null);
const KEEP = args.includes("--keep");
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("refusing: not a local database");

let failed = 0;
function check(ok, label, detail) {
  if (ok) console.log(`PASS ${label}`);
  else {
    failed++;
    console.log(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
  }
}

const id = () => crypto.randomBytes(18).toString("hex");
async function makeUser(pool, who, role = "user") {
  const { hashPassword } = await import("better-auth/crypto");
  const userId = id();
  const name = `zt_nd_${who}`;
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, now(), now())`,
    [userId, name, `${name}@example.invalid`, role]
  );
  await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    id(),
    userId,
    await hashPassword(fixture.PASSWORD),
  ]);
  return userId;
}

const tourOf = async (pool, userId) => (await pool.query("SELECT tour_seen_at, tour_reached FROM user_settings WHERE user_id = $1", [userId])).rows[0] ?? {};
const resetTour = (pool, userId) => pool.query("UPDATE user_settings SET tour_seen_at = NULL, tour_reached = NULL WHERE user_id = $1", [userId]);

/** The tour as it stands: which step, lit or not, its words, the ring, and the target its step list says it lights. */
function state(page, steps) {
  return page.evaluate((steps) => {
    const root = document.querySelector('[role="dialog"][data-tour]');
    if (!root) return null;
    const step = steps.find((s) => s.id === root.dataset.tour);
    const box = root.getBoundingClientRect();
    const hub = document.querySelector("[data-hub]");
    let target = null;
    for (const sel of step?.targets ?? []) {
      let el = hub?.querySelector(sel);
      if (el && !el.getClientRects().length && el.firstElementChild) el = el.firstElementChild;
      if (el && el.getBoundingClientRect().width > 0) {
        const r = el.getBoundingClientRect();
        target = { sel, x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
        break;
      }
    }
    const ring = root.querySelector("svg rect[stroke-width]");
    const n = (a) => Number(ring?.getAttribute(a) ?? 0);
    return {
      id: root.dataset.tour,
      lit: root.dataset.tourLit,
      count: root.querySelector("[data-tour-count]")?.textContent ?? "",
      title: root.querySelector("#nd-tour-title")?.textContent ?? "",
      line: root.querySelector("#nd-tour-line")?.textContent ?? "",
      ring: { x: n("x"), y: n("y"), w: n("width"), h: n("height") },
      target,
      // The lower third's top (its Skip pill's row), in the tour's box.
      lowerTop: (root.querySelector("[data-tour-skip]")?.parentElement?.getBoundingClientRect().top ?? box.bottom) - box.top,
      boxW: box.width,
      wide: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollY: window.scrollY,
    };
  }, steps);
}

/** Waits for step k to have its light on (or the screen dimmed, when nothing of it is on this Home), then a beat for a glide. */
async function onStep(page, steps, k) {
  await page.waitForFunction(
    (sid) => {
      const r = document.querySelector('[role="dialog"][data-tour]');
      return r && r.dataset.tour === sid && r.dataset.tourLit !== "off";
    },
    steps[k].id,
    { timeout: 9000 }
  );
  await page.waitForTimeout(550);
  return state(page, steps);
}

/** The ring sits around the target (padded 6, kept 4 inside the column). */
function ringFits(s) {
  if (!s.target) return s.lit === "dim";
  const want = { x: Math.max(4, s.target.x - 6), y: s.target.y - 6 };
  const right = Math.min(s.boxW - 4, s.target.x + s.target.w + 6);
  return s.lit === "on" && Math.abs(s.ring.x - want.x) <= 2 && Math.abs(s.ring.y - want.y) <= 2 && Math.abs(s.ring.x + s.ring.w - right) <= 2 && Math.abs(s.ring.h - (s.target.h + 12)) <= 2;
}

/** Counts the taps the examples show (each is up a third of a second: too quick to catch by looking now and then). */
const countTaps = (page) =>
  page.evaluate(() => {
    window.__taps = 0;
    new MutationObserver((ms) =>
      ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches(".nd-tour-tap") || n.querySelector(".nd-tour-tap")) && window.__taps++))
    ).observe(document.body, { childList: true, subtree: true });
  });
/** Ends the tour with `act` and waits for the account to keep it (the write is keepalive; a reload right after mustn't race it). */
async function endWith(page, act) {
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/me/tour") && r.request().method() === "POST", { timeout: 10000 }), act()]);
  await gone(page);
  return res.status();
}

const tourUp = (page) => page.$('[role="dialog"][data-tour]');
async function noTour(page, label) {
  await page.waitForTimeout(3500);
  check(!(await tourUp(page)), label);
}
async function gone(page) {
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][data-tour]'), null, { timeout: 6000 });
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function session(who, opts = {}) {
  const s = await open({ user: `zt_nd_${who}`, pass: fixture.PASSWORD, width: WIDTH, height: 844, ...opts });
  if (opts.notifications) await s.page.context().grantPermissions(["notifications"], { origin: s.BASE });
  return s;
}

/** Plays the tour through with Next, checking each step against the step list; returns the last state. */
async function playThrough(page, steps, who, { tapIn = "add" } = {}) {
  let s = null;
  for (let k = 0; k < steps.length; k++) {
    s = await onStep(page, steps, k);
    const want = steps[k];
    check(s.count === `${k + 1}/${steps.length}` && s.title === want.title && s.line === want.line, `${who} step ${k + 1}: ${want.id}, its count and words`, `${s.count} "${s.title}" "${s.line}"`);
    check(ringFits(s), `${who} step ${k + 1}: ${s.target ? `lights ${s.target.sel}` : "lights nothing, the screen dims"}`, JSON.stringify({ lit: s.lit, ring: s.ring, target: s.target }));
    check(!s.wide, `${who} step ${k + 1}: nothing wider than the screen`);
    check(!s.target || s.target.y + s.target.h + 6 <= s.lowerTop + 1, `${who} step ${k + 1}: what's lit is clear of the lower third`, s.target && `${Math.round(s.target.y + s.target.h)} vs ${Math.round(s.lowerTop)}`);
    if (want.id === tapIn) {
      const tapped = await page
        .waitForFunction(() => window.__taps > 0, null, { timeout: 7000 })
        .then(() => true)
        .catch(() => false);
      check(tapped, `${who} step ${k + 1}: its example plays once the light's on (a tap shows)`);
    }
    await shot(page, `${who}-${k + 1}-${want.id}`);
    if (k < steps.length - 1) await page.click("[data-tour-next]");
  }
  return s;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  const fx = await fixture.up(pool);
  const U = fx.users;
  U.solo = await makeUser(pool, "solo");
  U.admin = await makeUser(pool, "admin", "admin");
  // Solo: one show, as first run's "Just me for now" leaves someone (no couch).
  await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 3, true) ON CONFLICT DO NOTHING", [U.solo, fx.seasonId]);
  const errors = [];
  try {
    // ---- A. sam: all of it, to Not now ----
    {
      const { page, errors: e, BASE, close } = await session("sam", { notifications: true });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[role="dialog"][data-tour]', { timeout: 15000 });
        await countTaps(page);
        const steps = tourSteps({ solo: false, reminders: "off" });
        const s0 = await onStep(page, steps, 0);
        check(s0 && s0.scrollY > 0, "A: the page scrolls down to the first step (the guide)", `scrollY ${s0?.scrollY}`);
        const y = s0.scrollY;
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(400);
        check((await page.evaluate(() => window.scrollY)) === y, "A: Home doesn't scroll by hand under the tour");
        const last = await playThrough(page, steps, "sam");
        check(!!(await page.$("[data-tour-on]")) && !!(await page.$("[data-tour-later]")), "A: the last step asks: Turn on · Not now", last?.id);
        const status = await endWith(page, () => page.click("[data-tour-later]"));
        check(status === 200 && /Take the tour again/.test((await page.textContent('[data-toast="done"]').catch(() => "")) ?? ""), "A: Not now ends it, and says where it lives", String(status));
        const row = await tourOf(pool, U.sam);
        check(!!row.tour_seen_at && row.tour_reached === steps.length, "A: kept for the account, every step", JSON.stringify(row));
        await page.reload({ waitUntil: "domcontentloaded" });
        await noTour(page, "A: Home doesn't play it again");
      } finally {
        errors.push(...e.map((x) => `A: ${x}`));
        await close();
      }
    }

    // ---- B and C. alex: Skip at step 2; then Settings' Take the tour, and Escape ----
    {
      const { page, errors: e, BASE, close } = await session("alex");
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[role="dialog"][data-tour]', { timeout: 15000 });
        const n = Number((await page.textContent("[data-tour-count]")).split("/")[1]);
        const steps = tourSteps({ solo: false, reminders: n === 9 ? "off" : null });
        await onStep(page, steps, 0);
        await page.click("[data-tour-next]");
        const s = await onStep(page, steps, 1);
        check(ringFits(s), "B: step 2 lights Add a show", JSON.stringify(s?.target));
        await endWith(page, () => page.click("[data-tour-skip]"));
        const row = await tourOf(pool, U.alex);
        check(!!row.tour_seen_at && row.tour_reached === 2, "B: Skip at step 2 keeps it (step 2)", JSON.stringify(row));
        await page.reload({ waitUntil: "domcontentloaded" });
        await noTour(page, "B: Home doesn't play it again");
        const seenAt = row.tour_seen_at.toISOString();

        await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
        await page.click("text=Take the tour");
        await page.waitForURL(/\/home$/, { timeout: 8000 });
        await page.waitForSelector('[role="dialog"][data-tour]', { timeout: 15000 });
        check((await page.textContent("[data-tour-count]")).startsWith("1/"), "C: Settings › Take the tour plays it on Home, from the start");
        await endWith(page, () => page.keyboard.press("Escape"));
        const again = await tourOf(pool, U.alex);
        check(again.tour_reached === 2 && again.tour_seen_at.toISOString() === seenAt, "C: Escape skips; the first time it was seen and the furthest step stay", JSON.stringify(again));
      } finally {
        errors.push(...e.map((x) => `B/C: ${x}`));
        await close();
      }
    }

    // ---- D. sam: /home?tour=1 ----
    {
      const { page, errors: e, BASE, close } = await session("sam");
      try {
        await page.goto(BASE + "/home?tour=1", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[role="dialog"][data-tour]', { timeout: 15000 });
        await page.waitForTimeout(300);
        check(!/tour=1/.test(page.url()), "D: /home?tour=1 plays it, and ?tour comes off the address", page.url());
        await endWith(page, () => page.click("[data-tour-skip]"));
      } finally {
        errors.push(...e.map((x) => `D: ${x}`));
        await close();
      }
    }

    // ---- E. solo: the couch pitched, no Couch points, Turn on ends it ----
    {
      const { page, errors: e, BASE, close } = await session("solo", { notifications: true });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-hub="solo"]', { timeout: 15000 });
        await page.waitForSelector('[role="dialog"][data-tour]', { timeout: 15000 });
        await countTaps(page);
        const steps = tourSteps({ solo: true, reminders: "off" });
        check(!steps.some((s) => s.id === "points"), "E: no Couch points step for a solo player");
        await playThrough(page, steps, "solo");
        await endWith(page, () => page.click("[data-tour-on]"));
        const row = await tourOf(pool, U.solo);
        check(!!row.tour_seen_at && row.tour_reached === steps.length, "E: Turn on ends it, kept", JSON.stringify(row));
      } finally {
        // Turn on asks the browser for a push subscription, which a headless one may refuse: that's the reminder's own toast.
        errors.push(...e.filter((x) => !/push|subscri|service ?worker/i.test(x)).map((x) => `E: ${x}`));
        await close();
      }
    }

    // ---- F. riley, reduced motion ----
    {
      const { page, errors: e, BASE, close } = await session("riley", { motion: "reduce", notifications: true });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[role="dialog"][data-tour]', { timeout: 15000 });
        await countTaps(page);
        const steps = tourSteps({ solo: false, reminders: "off" });
        let ok = true;
        for (let k = 0; k < steps.length; k++) {
          const t0 = Date.now();
          const s = await onStep(page, steps, k);
          ok &&= Date.now() - t0 < 2000 && ringFits(s);
          if (k < steps.length - 1) await page.click("[data-tour-next]");
        }
        check(ok, "F: reduced motion: each step lit at once, around its target");
        await page.waitForTimeout(2500);
        check((await page.evaluate(() => window.__taps)) === 0, "F: reduced motion: the examples hold still (no taps)");
        await endWith(page, () => page.click("[data-tour-later]"));
      } finally {
        errors.push(...e.map((x) => `F: ${x}`));
        await close();
      }
    }

    // ---- G. an admin acting as jordan ----
    {
      const { page, errors: e, BASE, close } = await session("admin");
      try {
        await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
        const act = await page.evaluate(async (jordan) => (await fetch(`/api/desk/people/${jordan}/act`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, U.jordan);
        check(act === 200, "G: the desk's Act as them starts an hour as jordan", String(act));
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector("[data-viewing-as]", { timeout: 15000 });
        await noTour(page, "G: acting as jordan, Home doesn't play it");
        const wrote = await page.evaluate(async () => (await fetch("/api/me/tour", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reached: 3 }) })).json());
        check(wrote.kept === false && !(await tourOf(pool, U.jordan)).tour_seen_at, "G: acting as jordan, a write isn't kept for them", JSON.stringify(wrote));
        await page.evaluate(() => fetch("/api/desk/acting", { method: "DELETE" }));
      } finally {
        errors.push(...e.map((x) => `G: ${x}`));
        await close();
      }
    }

    // ---- H. riley in Studio ----
    {
      await pool.query("UPDATE user_settings SET theme = 'studio' WHERE user_id = $1", [U.riley]);
      await resetTour(pool, U.riley);
      const { page, errors: e, BASE, close } = await session("riley", { notifications: true });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[role="dialog"][data-tour]', { timeout: 15000 });
        const steps = tourSteps({ solo: false, reminders: "off" });
        check(!(await page.evaluate(() => document.documentElement.classList.contains("dark"))), "H: Studio (light) is on");
        for (let k = 0; k < steps.length; k++) {
          const s = await onStep(page, steps, k);
          if (["couch", "move", "reveal", "points"].includes(s.id)) await shot(page, `studio-${k + 1}-${s.id}`);
          if (k < steps.length - 1) await page.click("[data-tour-next]");
        }
        await endWith(page, () => page.click("[data-tour-later]"));
        check(true, "H: Studio plays through");
      } finally {
        errors.push(...e.map((x) => `H: ${x}`));
        await close();
      }
    }
  } finally {
    check(errors.length === 0, "no page errors", errors.slice(0, 6).join(" | "));
    if (!KEEP) await fixture.down(pool);
    await pool.end();
  }
  console.log(failed ? `${failed} FAILED` : "all passed");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
