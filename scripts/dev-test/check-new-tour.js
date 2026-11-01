// Dev-only check of the first-time tour, version 2 (docs/PLAN-first-time-tour.md, src/new/tour/): a welcome card, then the real
// Home a step at a time; Add a show, the reveal and Start a game tried as practice runs that save nothing; Add a show's demo (it
// adds a couple of shows by itself) and the guide step that shows them; kept once an account:
//   A. sam (results waiting; notifications allowed): the card, every step's count, words and light, and each practice end to end:
//      the practice show the catalog says (the first of Survivor, The Amazing Race, The Challenge sam doesn't have) typed in and
//      ringed, Where are you, its finish (won't show up; you don't need a game), Show me: the demo adds Harry Potter and the NFL's
//      next game by itself, the guide step shows that game on its day and both on Your shows (gone at the next step); the reveal
//      replays sam's last episode with nothing that would be real (no Share, no next episode); Start a game: the practice show
//      first, its rules' moment, the Prediction Sheet chosen, Create a game with AI (coming soon), its finish. Nothing written:
//      no write but the tour's own and the replay's (with replay: true), and sam's follows, marks, leagues and chat as they were.
//      Explore keeps it (seen, every step); Home doesn't play it again.
//   B/C. alex: Skip on the welcome card keeps it (step 1); Settings › Take the tour plays it again; Escape skips it.
//   D. sam: /home?tour=1 plays it and takes ?tour off the address.
//   K. sam: the menu behind your picture › Take the tour plays it there and then; once played, a reload doesn't play it again.
//   E. zt_nd_solo (no couch, one show, no game): no Start a game practice (the couch pitched), a made-up reveal (no server call);
//      Turn on ends it.
//   F. riley with reduced motion: each step lit at once; Start a game's rules moment still shows (a pause, not a movement).
//   G. zt_nd_admin acting as jordan (the desk's Act as them): Home doesn't play it, and a write isn't kept.
//   I. casey leaves Home mid-tour by a move inside the app (as the phone's back): kept as a skip at that step.
//   H. riley in Studio: plays through, with no page errors.
//   J. the real Start a game sheet (no tour): Create a game with AI, coming soon, for everyone.
// Nothing wider than the screen; no page errors.
//
//   node scripts/lane.js dev                                  (the server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-new-tour.js [--width=390] [--shots=<dir>] [--keep]
//
// Brings new-fixture.js's couch up (its zt_nd_ people) and adds zt_nd_solo (on no couch, following its season) and zt_nd_admin
// (a site admin); takes them all down at the end unless --keep (new-fixture's down removes every zt_nd_ account). The TV listings
// are fake-listings.js with HBO's Harry Potter and the NFL's three weekly games under their real TVmaze ids (the demo finds them
// by id: tour/plan.ts), each game in the coming week; nothing is added from them (the practice saves nothing). Needs the real
// Survivor, The Amazing Race or The Challenge set up as a game in the database (a copy of production has Survivor 51). Refuses a
// non-local database. Don't run it beside another check on the same database: they share the zt_nd_ fixture.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { tourSteps } = jiti("../../src/new/tour/steps.ts");
const { demoOf, practiceShowOf, replayOf } = jiti("../../src/new/tour/plan.ts");
const { open } = require("./browser");
const fixture = require("./new-fixture");
const listings = require("./fake-listings");

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
/** What a practice could have written for someone: their follows (and where they are), their marks, their games, their chat. */
async function rowsOf(pool, userId) {
  const q = async (sql) => JSON.stringify((await pool.query(sql, [userId])).rows);
  return {
    follows: await q("SELECT season_id, seen_through, following, private, keep_up, early_seen, early_night FROM show_follows WHERE user_id = $1 ORDER BY season_id"),
    marks: await q("SELECT league_id, results_seen_through FROM league_memberships WHERE user_id = $1 ORDER BY league_id"),
    leagues: await q("SELECT count(*)::int AS n FROM leagues WHERE created_by = $1"),
    chat: await q("SELECT count(*)::int AS n FROM chat_messages WHERE user_id = $1"),
  };
}

// The demo's shows in the stand-in listings: HBO's Harry Potter (upcoming) and the NFL's three weekly games, each next on its day.
const DAY = 24 * 3600 * 1000;
function nextDay(day, hour, minute) {
  const t = new Date();
  t.setHours(hour, minute, 0, 0);
  let d = (day - t.getDay() + 7) % 7;
  if (d === 0 && t.getTime() < Date.now()) d = 7;
  return t.getTime() + d * DAY;
}
const DEMO_SHOWS = () => [
  listings.oneNight(68803, "ZT Harry Potter", Date.now() + 54 * DAY, { type: "Scripted", network: "ZT HBO", episodes: 8 }),
  listings.oneNight(30940, "ZT Sunday Night Football", nextDay(0, 20, 20), { type: "Sports", network: "ZT NBC", season: 2026, first: 9, runtime: 200 }),
  listings.oneNight(30941, "ZT Monday Night Football", nextDay(1, 20, 15), { type: "Sports", network: "ZT ESPN", season: 2026, first: 9, runtime: 200 }),
  listings.oneNight(59591, "ZT Thursday Night Football", nextDay(4, 20, 15), { type: "Sports", web: { name: "ZT Prime", country: "US" }, season: 2026, first: 9, runtime: 200 }),
];

/** The tour as it stands: which step, lit or not, its words, the ring, and what its step list says it lights (all, for `union`). */
function state(page, steps) {
  return page.evaluate((steps) => {
    const root = document.querySelector('[role="dialog"][data-tour]');
    if (!root) return null;
    const step = steps.find((s) => s.id === root.dataset.tour);
    const box = root.getBoundingClientRect();
    const hub = document.querySelector("[data-hub]");
    const boxed = (sel) => {
      let el = hub?.querySelector(sel);
      if (el && !el.getClientRects().length && el.firstElementChild) el = el.firstElementChild;
      return el && el.getBoundingClientRect().width > 0 ? el : null;
    };
    const found = (step?.targets ?? []).map((sel) => [sel, boxed(sel)]).filter(([, el]) => el);
    const use = step?.union ? found : found.slice(0, 1);
    let target = null;
    if (use.length) {
      const rs = use.map(([, el]) => el.getBoundingClientRect());
      const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
      const r = Math.max(...rs.map((x) => x.right)), b = Math.max(...rs.map((x) => x.bottom));
      target = { sel: use.map(([s]) => s).join(" + "), x: l - box.left, y: t - box.top, w: r - l, h: b - t };
    }
    const ring = root.querySelector("svg rect[stroke-width]");
    const n = (a) => Number(ring?.getAttribute(a) ?? 0);
    return {
      id: root.dataset.tour,
      lit: root.dataset.tourLit,
      count: root.querySelector("[data-tour-count]")?.textContent ?? "",
      title: root.querySelector("#nd-tour-title")?.textContent ?? "",
      line: root.querySelector("#nd-tour-line")?.textContent ?? "",
      act: root.querySelector("[data-tour-act]")?.getAttribute("data-tour-act") ?? null,
      ring: { x: n("x"), y: n("y"), w: n("width"), h: n("height") },
      target,
      lowerTop: (root.querySelector("[data-tour-lower]")?.getBoundingClientRect().top ?? box.bottom) - box.top,
      boxW: box.width,
      wide: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollY: window.scrollY,
    };
  }, steps);
}

/** Waits for step k on Home to have its light on (or the screen dimmed, when nothing of it is on this Home), then a beat for a glide. */
async function onStep(page, steps, k) {
  await page.waitForFunction(
    (sid) => {
      const r = document.querySelector('[role="dialog"][data-tour]');
      return r && r.dataset.tour === sid && r.dataset.tourLit !== "off" && !r.hasAttribute("data-tour-away");
    },
    steps[k].id,
    { timeout: 12000 }
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

/** Step k's count, words, light, and its place clear of the lower third. */
function stepChecks(who, s, steps, k) {
  const want = steps[k];
  check(s.count === `${k + 1}/${steps.length}` && s.title === want.title && s.line === want.line, `${who} step ${k + 1}: ${want.id}, its count and words`, `${s.count} "${s.title}" "${s.line}"`);
  check(ringFits(s), `${who} step ${k + 1}: ${s.target ? `lights ${s.target.sel}` : "lights nothing, the screen dims"}`, JSON.stringify({ lit: s.lit, ring: s.ring, target: s.target }));
  check(!s.wide, `${who} step ${k + 1}: nothing wider than the screen`);
  check(!s.target || s.target.y + s.target.h + 6 <= s.lowerTop + 1, `${who} step ${k + 1}: what's lit is clear of the lower third`, s.target && `${Math.round(s.target.y + s.target.h)} vs ${Math.round(s.lowerTop)}`);
  check((s.act ?? null) === (want.act?.kind ?? null), `${who} step ${k + 1}: ${want.act ? `its practice (${want.act.label})` : "no practice"}`, String(s.act));
}

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
/** The welcome card, up. */
const welcome = (page) => page.waitForSelector("[data-tour-welcome].opacity-100", { timeout: 20000 });
/** Back from a practice: the step ticks (its count turns green), then the next one. */
const ticked = (page) => page.waitForSelector('[data-tour-count="done"]', { timeout: 10000 });

let HEADERS = {};
async function session(who, opts = {}) {
  // `tour: true`: browser.js turns the tour off for every other check.
  const s = await open({ user: `zt_nd_${who}`, pass: fixture.PASSWORD, width: WIDTH, height: 844, tour: true, headers: HEADERS, ...opts });
  if (opts.notifications) await s.page.context().grantPermissions(["notifications"], { origin: s.BASE });
  return s;
}
/** The tour's steps for whoever's signed in, as the tour works them out: from their Home and the catalog. */
async function stepsFor(page, { solo = false, reminders = "off" } = {}) {
  const [home, catalog] = await page.evaluate(() => Promise.all([fetch("/api/me/home").then((r) => r.json()), fetch("/api/catalog").then((r) => r.json())]));
  const practice = practiceShowOf(catalog.seasons, home);
  const replay = replayOf(home);
  return { steps: tourSteps({ solo, reminders, show: practice?.name ?? null, replay: !!replay }), practice, replay, demo: demoOf(home) };
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  const tv = await listings.start({ shows: DEMO_SHOWS() });
  HEADERS = { "x-gys-listings": tv.url };
  const fx = await fixture.up(pool);
  const U = fx.users;
  U.solo = await makeUser(pool, "solo");
  U.admin = await makeUser(pool, "admin", "admin");
  // Solo: one show, as first run's "Just me for now" leaves someone (no couch, no game).
  await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 3, true) ON CONFLICT DO NOTHING", [U.solo, fx.seasonId]);
  const errors = [];
  try {
    // ---- A. sam: all of it, every practice, to Explore ----
    {
      const { page, errors: e, BASE, close } = await session("sam", { notifications: true });
      const writes = [];
      page.on("request", (r) => {
        if (!["GET", "HEAD", "OPTIONS"].includes(r.method())) writes.push({ m: r.method(), u: new URL(r.url()).pathname, b: r.postData() ?? "" });
      });
      try {
        const before = await rowsOf(pool, U.sam);
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await welcome(page);
        const { steps, practice, replay, demo } = await stepsFor(page);
        check(!!practice, "A: the catalog has a practice show for sam (Survivor, The Amazing Race or The Challenge, set up as a game)", JSON.stringify(practice));
        check(!!replay, "A: sam has a reveal to replay (a game, an episode revealed)", JSON.stringify(replay));
        check((await page.textContent("[data-tour-welcome]")).includes(`1/${steps.length}`), `A: the welcome card, 1/${steps.length}`);
        await shot(page, "sam-1-welcome");
        await page.click("[data-tour-go]");

        // 2: Your Home.
        let s = await onStep(page, steps, 1);
        stepChecks("sam", s, steps, 1);
        const y = s.scrollY;
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(400);
        check((await page.evaluate(() => window.scrollY)) === y, "A: Home doesn't scroll by hand under the tour");
        await shot(page, "sam-2-home");
        await page.click("[data-tour-next]");

        // 3: Add a show, practice.
        s = await onStep(page, steps, 2);
        stepChecks("sam", s, steps, 2);
        await shot(page, "sam-3-add");
        await page.click('[data-tour-act="add"]');
        await page.waitForSelector("[role=dialog][data-open] [data-practice]", { timeout: 15000 });
        await page.waitForSelector("[data-practice-pick]", { timeout: 20000 });
        check((await page.inputValue("[data-add-input]")) === practice.name, "A: Add a show's practice types the practice show's name", await page.inputValue("[data-add-input]"));
        await shot(page, "sam-3a-typed");
        await page.click("[data-practice-pick]");
        await page.waitForSelector("[role=dialog][data-open] [data-where-save]", { timeout: 15000 });
        await page.click("[role=dialog][data-open] [data-where-save]");
        await page.waitForSelector("[data-practice-done]", { timeout: 10000 });
        const fin = await page.textContent("[data-practice-done]");
        check(fin.includes(`${practice.label} won't show up`) && /You don.t need a game to add a show/.test(fin) && /Show me$/.test(fin.trim()), "A: its finish: it won't show up; you don't need a game; Show me", fin);
        await shot(page, "sam-3b-finish");
        // Show me: the demo adds the rest by itself.
        await page.click("[data-practice-close]");
        await page.waitForSelector('[data-add-show="demoed"] [data-practice-done]', { timeout: 45000 });
        const names = demo.map((d) => DEMO_SHOWS().find((x) => x.show.id === d.tvmazeId).show.name);
        const demoed = await page.textContent("[data-practice-done]");
        check(names.every((n) => demoed.includes(n)) && demoed.includes("won't show up either"), `A: Show me: the tour adds ${names.join(" and ")} by itself, and says they won't show up either`, demoed);
        await shot(page, "sam-3c-demoed");
        await page.click("[data-practice-close]");
        await ticked(page);
        check(true, "A: back from Add a show, the step ticks");

        // 4: the guide, with the demo's shows in it for a moment.
        s = await onStep(page, steps, 3);
        stepChecks("sam", s, steps, 3);
        await page.waitForTimeout(800);
        const nfl = demo.find((d) => d.tvmazeId !== 68803);
        const cards = await page.$$eval("[data-guide-card]", (c) => c.map((x) => x.getAttribute("aria-label") ?? ""));
        const nflName = nfl && DEMO_SHOWS().find((x) => x.show.id === nfl.tvmazeId).show.name;
        check(!nfl || cards.some((c) => c.startsWith(nflName)), `A: the guide has the demo's game (${nflName})`, cards.join(" | "));
        const shelf = await page.$$eval("[data-poster]", (p) => p.map((x) => x.getAttribute("data-poster")));
        check(demo.every((d) => shelf.includes(`tour-${d.tvmazeId}`)), "A: and Your shows has the demo's shows", shelf.join(", "));
        check(!!(await page.$('[data-guide-reel]')) && (await page.evaluate(() => document.querySelector("[data-guide-reel]").scrollLeft)) < 8, "A: the guide's held on today");
        await shot(page, "sam-4-guide");
        await page.click("[data-tour-next]");

        // 5: the reveal, replayed.
        s = await onStep(page, steps, 4);
        stepChecks("sam", s, steps, 4);
        const shelfAfter = await page.$$eval("[data-poster]", (p) => p.map((x) => x.getAttribute("data-poster")));
        check(!shelfAfter.some((x) => x.startsWith("tour-")), "A: past the guide, the demo's shows are off Home", shelfAfter.join(", "));
        await shot(page, "sam-5-reveal");
        await page.click('[data-tour-act="reveal"]');
        await page.waitForSelector('[data-tour-reveal="replay"] [data-beat]', { timeout: 20000 });
        await shot(page, "sam-5a-replay");
        for (let k = 0; k < 8 && !(await page.$("[data-tour-reveal-done]")); k++) {
          await page.click("[data-tour-reveal] [data-stage]");
          await page.waitForTimeout(350);
        }
        const end = await page.textContent("[data-tour-reveal]");
        check(!!(await page.$("[data-tour-reveal-done]")) && !/Share your night/.test(end) && !/Reveal Episode/.test(end), "A: the replay ends on Back to the tour: no Share your night, no next episode");
        await shot(page, "sam-5b-replay-end");
        await page.click("[data-tour-reveal-done]");
        await ticked(page);

        // 6: Start a game, practice: the Prediction Sheet.
        s = await onStep(page, steps, 5);
        stepChecks("sam", s, steps, 5);
        await shot(page, "sam-6-start");
        await page.click('[data-tour-act="start"]');
        await page.waitForSelector(`[data-pick-practice][data-pick-show="${practice.seasonId}"]`, { timeout: 15000 });
        check(true, "A: Start a game's practice offers the practice show first");
        await shot(page, "sam-6a-pick");
        await page.click("[data-pick-practice]");
        const warmed = await page.waitForSelector("[data-start-warming]", { timeout: 6000 }).then(() => true, () => false);
        check(warmed, "A: picking it, a moment getting its rules");
        await page.waitForSelector("[data-start-go]", { timeout: 30000 });
        check((await page.getAttribute('[data-start-game="questions"]', "aria-pressed")) === "true", "A: the Prediction Sheet chosen");
        check(!!(await page.$("[data-coming-soon-ai]")), "A: Create a game with AI, coming soon, in the sheet");
        await shot(page, "sam-6b-options");
        await page.click("[data-start-go]");
        await page.waitForSelector("[data-practice-done]", { timeout: 10000 });
        const started = await page.textContent("[data-practice-done]");
        check(/Prediction Sheet .* won't show up/.test(started) && !!(await page.$("[data-practice-done] [data-coming-soon-ai]")), "A: its finish: it won't show up, and the AI's coming", started);
        await shot(page, "sam-6c-finish");
        await page.click("[data-practice-close]");
        await ticked(page);

        // 7: you're set: reminders, Explore.
        s = await onStep(page, steps, 6);
        stepChecks("sam", s, steps, 6);
        check(!!(await page.$("[data-tour-on]")) && !!(await page.$("[data-tour-explore]")), "A: the last step: Turn on reminders · Explore");
        await shot(page, "sam-7-done");
        const status = await endWith(page, () => page.click("[data-tour-explore]"));
        check(status === 200 && /your picture to take the tour again/.test((await page.textContent('[data-toast="done"]').catch(() => "")) ?? ""), "A: Explore ends it, and says where it lives", String(status));
        const row = await tourOf(pool, U.sam);
        check(!!row.tour_seen_at && row.tour_reached === steps.length, "A: kept for the account, every step", JSON.stringify(row));

        // Nothing written by any practice.
        const bad = writes.filter((w) => /^\/api\/me\/shows|^\/api\/me\/follows\/|^\/api\/seasons\/[^/]+\/start$/.test(w.u) || (/\/reveal$/.test(w.u) && !/"replay":true/.test(w.b)));
        check(bad.length === 0, "A: no practice wrote anything (no add, follow, start, or reveal but a replay)", bad.map((w) => `${w.m} ${w.u}`).join(", "));
        check(writes.some((w) => /\/reveal$/.test(w.u)), "A: the replay asked the server (with replay: true)");
        const after = await rowsOf(pool, U.sam);
        for (const k of Object.keys(before)) check(before[k] === after[k], `A: sam's ${k} as they were`, `${before[k]} → ${after[k]}`);
        await page.reload({ waitUntil: "domcontentloaded" });
        await noTour(page, "A: Home doesn't play it again");
      } finally {
        errors.push(...e.map((x) => `A: ${x}`));
        await close();
      }
    }

    // ---- B and C. alex: Skip on the welcome card; then Settings' Take the tour, and Escape ----
    {
      const { page, errors: e, BASE, close } = await session("alex");
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await welcome(page);
        await shot(page, "alex-welcome");
        await endWith(page, () => page.click("[data-tour-welcome] [data-tour-skip]"));
        const row = await tourOf(pool, U.alex);
        check(!!row.tour_seen_at && row.tour_reached === 1, "B: Skip on the welcome card keeps it (step 1)", JSON.stringify(row));
        await page.reload({ waitUntil: "domcontentloaded" });
        await noTour(page, "B: Home doesn't play it again");
        const seenAt = row.tour_seen_at.toISOString();

        await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
        await page.click("text=Take the tour");
        await page.waitForURL(/\/home$/, { timeout: 8000 });
        await welcome(page);
        check(true, "C: Settings › Take the tour plays it on Home, from the welcome card");
        await page.click("[data-tour-go]");
        await page.waitForFunction(() => document.querySelector('[role="dialog"][data-tour]')?.dataset.tour === "home", null, { timeout: 8000 });
        await endWith(page, () => page.keyboard.press("Escape"));
        const again = await tourOf(pool, U.alex);
        check(again.tour_reached === 2 && again.tour_seen_at.toISOString() === seenAt, "C: Escape skips; the first time it was seen stays, the furthest step moves on", JSON.stringify(again));
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
        await welcome(page);
        await page.waitForTimeout(300);
        check(!/tour=1/.test(page.url()), "D: /home?tour=1 plays it, and ?tour comes off the address", page.url());
        await endWith(page, () => page.click("[data-tour-welcome] [data-tour-skip]"));
      } finally {
        errors.push(...e.map((x) => `D: ${x}`));
        await close();
      }
    }

    // ---- K. sam: your picture › Take the tour, on Home itself ----
    {
      const { page, errors: e, BASE, close } = await session("sam");
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await noTour(page, "K: sam's seen it, so Home doesn't play it by itself");
        await page.click('button[aria-label="Your profile"]');
        await page.click("[role=dialog][data-open] [data-take-tour]", { timeout: 8000 });
        await welcome(page);
        check(/\/home$/.test(page.url()) && !(await page.$("[role=dialog][data-open] [data-take-tour]")), "K: your picture › Take the tour: the menu closes and the tour plays on Home", page.url());
        await shot(page, "sam-picture-tour");
        await page.click("[data-tour-go]");
        await page.waitForFunction(() => document.querySelector('[role="dialog"][data-tour]')?.dataset.tour === "home", null, { timeout: 8000 });
        await endWith(page, () => page.keyboard.press("Escape"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await noTour(page, "K: once it's played, a reload doesn't play it again");
      } finally {
        errors.push(...e.map((x) => `K: ${x}`));
        await close();
      }
    }

    // ---- E. solo: no Start a game practice, a made-up reveal, Turn on ends it ----
    {
      const { page, errors: e, BASE, close } = await session("solo", { notifications: true });
      const reveals = [];
      page.on("request", (r) => /\/reveal$/.test(new URL(r.url()).pathname) && reveals.push(r.url()));
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-hub="solo"]', { timeout: 15000 });
        await welcome(page);
        const { steps } = await stepsFor(page, { solo: true });
        check(!steps.find((x) => x.id === "start").act, "E: no Start a game practice for a solo player");
        await page.click("[data-tour-go]");
        for (let k = 1; k < steps.length; k++) {
          const s = await onStep(page, steps, k);
          stepChecks("solo", s, steps, k);
          if (steps[k].id === "reveal") {
            await page.click('[data-tour-act="reveal"]');
            await page.waitForSelector('[data-tour-reveal="made"] [data-beat]', { timeout: 8000 });
            check(/Golden Crust/.test(await page.textContent("[data-tour-reveal]")), "E: nothing to replay: a made-up reveal (Golden Crust)");
            await shot(page, "solo-reveal-made");
            for (let j = 0; j < 8 && !(await page.$("[data-tour-reveal-done]")); j++) {
              await page.click("[data-tour-reveal] [data-stage]");
              await page.waitForTimeout(250);
            }
            await page.click("[data-tour-reveal-done]");
            await ticked(page);
            continue;
          }
          if (k < steps.length - 1) await page.click("[data-tour-next]");
        }
        check(reveals.length === 0, "E: the made-up reveal asks the server nothing", reveals.join(", "));
        await endWith(page, () => page.click("[data-tour-on]"));
        const row = await tourOf(pool, U.solo);
        check(!!row.tour_seen_at && row.tour_reached === steps.length, "E: Turn on reminders ends it, kept", JSON.stringify(row));
      } finally {
        // Turn on asks the browser for a push subscription, which a headless one may refuse: that's the reminder's own toast.
        errors.push(...e.filter((x) => !/push|subscri|service ?worker/i.test(x)).map((x) => `E: ${x}`));
        await close();
      }
    }

    // ---- F. riley, reduced motion: lit at once; the rules' moment still shows ----
    {
      const { page, errors: e, BASE, close } = await session("riley", { motion: "reduce", notifications: true });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await welcome(page);
        const { steps } = await stepsFor(page);
        await page.click("[data-tour-go]");
        let ok = true;
        for (let k = 1; k < steps.length; k++) {
          const t0 = Date.now();
          const s = await onStep(page, steps, k);
          ok &&= Date.now() - t0 < 2500 && ringFits(s);
          if (steps[k].id === "start") {
            await page.click('[data-tour-act="start"]');
            await page.click("[data-pick-practice]", { timeout: 15000 });
            const warmed = await page.waitForSelector("[data-start-warming]", { timeout: 4000 }).then(() => true, () => false);
            check(warmed, "F: reduced motion: Start a game's rules moment still shows");
            await page.waitForSelector("[data-start-go]", { timeout: 30000 });
            await page.keyboard.press("Escape");
            await ticked(page);
            continue;
          }
          if (k < steps.length - 1) await page.click("[data-tour-next]");
        }
        check(ok, "F: reduced motion: each step lit at once, around its target");
        await endWith(page, () => page.click("[data-tour-explore]"));
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

    // ---- I. casey leaves Home mid-tour (a move inside the app, as the phone's back makes): it counts as a skip ----
    {
      const { page, errors: e, BASE, close } = await session("casey");
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await welcome(page);
        await page.click("[data-tour-go]");
        await page.waitForFunction(() => document.querySelector('[role="dialog"][data-tour]')?.dataset.tourLit !== "off", null, { timeout: 9000 });
        await page.waitForTimeout(500);
        const [res] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/api/me/tour") && r.request().method() === "POST", { timeout: 10000 }),
          page.evaluate(() => window.next.router.push("/settings")),
        ]);
        const row = await tourOf(pool, U.casey);
        check(res.status() === 200 && !!row.tour_seen_at && row.tour_reached === 2, "I: leaving Home mid-tour counts as a skip (step 2)", JSON.stringify(row));
        await page.waitForTimeout(800);
        check(!(await tourUp(page)), "I: and the tour's gone with Home");
      } finally {
        errors.push(...e.map((x) => `I: ${x}`));
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
        await welcome(page);
        check(!(await page.evaluate(() => document.documentElement.classList.contains("dark"))), "H: Studio (light) is on");
        await shot(page, "studio-1-welcome");
        const { steps } = await stepsFor(page);
        await page.click("[data-tour-go]");
        for (let k = 1; k < steps.length; k++) {
          const s = await onStep(page, steps, k);
          await shot(page, `studio-${k + 1}-${s.id}`);
          if (k < steps.length - 1) await page.click("[data-tour-next]");
        }
        await endWith(page, () => page.click("[data-tour-explore]"));
        check(true, "H: Studio plays through");
      } finally {
        errors.push(...e.map((x) => `H: ${x}`));
        await close();
      }
    }

    // ---- J. the real Start a game sheet: Create a game with AI, coming soon ----
    {
      const { page, errors: e, BASE, close } = await open({ user: "zt_nd_alex", pass: fixture.PASSWORD, width: WIDTH, height: 844, headers: HEADERS });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.click("[data-foot-start]", { timeout: 20000 });
        await page.click("[data-pick-show]", { timeout: 10000 });
        await page.waitForSelector("[data-start-go]", { timeout: 30000 });
        check(!!(await page.$("[role=dialog][data-open] [data-coming-soon-ai]")) && !(await page.$("[data-practice]")), "J: the real Start a game sheet: Create a game with AI, coming soon (and no Practice strip)");
        await shot(page, "start-game-ai");
      } finally {
        errors.push(...e.map((x) => `J: ${x}`));
        await close();
      }
    }
  } finally {
    check(errors.length === 0, "no page errors", errors.slice(0, 6).join(" | "));
    if (!KEEP) await fixture.down(pool);
    await pool.end();
    await tv.close();
  }
  console.log(failed ? `${failed} FAILED` : "all passed");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
