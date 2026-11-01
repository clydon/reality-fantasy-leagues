// Dev-only check of the first-time tour, version 3 (docs/PLAN-first-time-tour.md, src/new/tour/): a welcome card, up top, down Home a
// section a beat, then hands on, each real thing tapped by the person (the plate's Try it only shakes it): your moves for real (the
// top line's page, Back to the tour), Add a show as a practice that saves nothing (and its demo), a show flipped over to your games,
// the TV guide's filters, the reveal replayed, Start a game as a practice; kept once an account:
//   A. sam (results waiting; notifications allowed): the card; every step's count, words and light, down Home's beats with a dot
//      each; your moves: Try it shakes the top line and goes nowhere, the line itself goes to its show, Back to the tour brings Home
//      and the step ticks, and that's no skip; Add a show: Try it shakes the tile, the tile itself opens the practice: the practice
//      show the catalog says (the first of Survivor, The Amazing Race, The Challenge sam doesn't have) typed in, slowly enough to
//      follow, and ringed, Where are you, its finish (won't show up; you don't need a game), Show me: the demo adds Harry Potter and
//      the NFL's next game by itself, slowly enough to follow (its Add to my shows ringed and pressed before the tap); Flip a show:
//      Try it shakes the corner, the tap turns sam's show over to sam's games and back, the demo's shows on the shelf; the TV guide:
//      the demo's game on its day, held on today, its filters working through the tour, Sports saying it's coming; the reveal
//      replays sam's last episode with nothing that would be real (no Share, no next episode), the demo's shows gone by then; Start
//      a game: the practice show first, its rules' moment, the Prediction Sheet chosen, Create a game with AI (coming soon), Start it
//      in sight in the sheet's foot without scrolling, its finish. Nothing written: no write but the tour's own and the replay's
//      (with replay: true), and sam's follows, marks, leagues and chat as they were. Explore keeps it (seen, to the last step);
//      Home doesn't play it again.
//   B/C. alex: Skip on the welcome card keeps it (step 1); Settings › Take the tour plays it again; Escape skips it.
//   D. sam: /home?tour=1 plays it and takes ?tour off the address.
//   K. sam: the menu behind your picture › Take the tour plays it there and then; once played, a reload doesn't play it again.
//   E. zt_nd_solo (no couch, one show, no game): no Start a game practice (the couch pitched), no flip, a made-up reveal (no server
//      call); Turn on ends it.
//   F. riley with reduced motion: each step lit at once; Try it blinks the ring and moves nothing; Start a game's rules moment
//      still shows (a pause, not a movement).
//   G. zt_nd_admin acting as jordan (the desk's Act as them): Home doesn't play it, and a write isn't kept.
//   I. casey leaves Home mid-tour by a move inside the app (as the phone's back): kept as a skip at that step.
//   H. riley in Studio: plays through, with no page errors.
//   J. the real Start a game sheet (no tour): Create a game with AI, coming soon, for everyone; Start it in the sheet's foot.
//   L. jordan: on the first step with a real thing to tap, the plate says Try it where Next was the step before, and a tap there
//      (or anywhere off what's lit) shakes it and does nothing else; the skip pill (its own words) moves on (the user, 2026-11-01:
//      Next skipped it by habit; then: Try it mustn't do it for them).
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
const { numbered, tourSteps } = jiti("../../src/new/tour/steps.ts");
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
      beats: root.querySelectorAll("[data-tour-beats] i").length,
      title: root.querySelector("#nd-tour-title")?.textContent ?? "",
      line: root.querySelector("#nd-tour-line")?.textContent ?? "",
      act: root.querySelector("[data-tour-act]")?.getAttribute("data-tour-act") ?? null,
      skip: root.querySelector("[data-tour-skip-step]")?.textContent?.trim() ?? null,
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
      return r && r.dataset.tour === sid && r.dataset.tourLit !== "off" && !r.hasAttribute("data-tour-away") && !r.querySelector('[data-tour-count="done"]');
    },
    steps[k].id,
    { timeout: 15000 }
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

/** Step k's count (down Home's beats share one, a dot each), words, light, its place clear of the lower third, and what's to tap. */
function stepChecks(who, s, plan, k) {
  const { steps, nums, of } = plan;
  const want = steps[k];
  const beats = want.part ? steps.filter((x) => x.part === want.part).length : 0;
  const label = `${who} step ${nums[k]}${beats > 1 ? ` (${want.id})` : ""}`;
  check(s.count === `${nums[k]}/${of}` && s.title === want.title && s.line === want.line && s.beats === (beats > 1 ? beats : 0), `${label}: ${want.id}, its count and words`, `${s.count} ·${s.beats} "${s.title}" "${s.line}"`);
  check(ringFits(s), `${label}: ${s.target ? `lights ${s.target.sel}` : "lights nothing, the screen dims"}`, JSON.stringify({ lit: s.lit, ring: s.ring, target: s.target }));
  check(!s.wide, `${label}: nothing wider than the screen`);
  check(!s.target || s.target.y + s.target.h + 6 <= s.lowerTop + 1, `${label}: what's lit is clear of the lower third`, s.target && `${Math.round(s.target.y + s.target.h)} vs ${Math.round(s.lowerTop)}`);
  check((s.act ?? null) === (want.act?.kind ?? null) && (s.skip ?? null) === (want.act?.skip ?? null), `${label}: ${want.act ? `its real thing to tap (${want.act.kind}; "${want.act.skip}")` : "nothing to tap"}`, `${s.act} "${s.skip}"`);
}

/** Ends the tour with `act` and waits for the account to keep it (the write is keepalive; a reload right after mustn't race it). */
async function endWith(page, act) {
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/me/tour") && r.request().method() === "POST", { timeout: 10000 }), act()]);
  await gone(page);
  return res.status();
}

const tourUp = (page) => page.$('[role="dialog"][data-tour]');
const tourId = (page) => page.evaluate(() => document.querySelector('[role="dialog"][data-tour]')?.dataset.tour ?? null);
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
/** Back from a step's real thing: the step ticks (its count turns green), then the next one. */
const ticked = (page) => page.waitForSelector('[data-tour-count="done"]', { timeout: 15000 });

/** A finger on what's lit (the tour takes the tap and passes it on). */
async function tapLit(page) {
  const c = await page.evaluate(() => {
    const root = document.querySelector('[role="dialog"][data-tour]');
    const ring = root.querySelector("svg rect[stroke-width]");
    const b = root.getBoundingClientRect();
    const n = (a) => Number(ring.getAttribute(a));
    return { x: b.left + n("x") + n("width") / 2, y: b.top + n("y") + n("height") / 2 };
  });
  await page.mouse.click(c.x, c.y);
}
/** A finger on something of Home's, under the tour. */
async function tapAt(page, sel) {
  const c = await page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(c.x, c.y);
}
/** Whether the step's thing to tap is moving right now (Try it's shake: a Web Animation on it); `ring`, the tour's ring instead. */
const shook = (page, step, ring = false) =>
  page.evaluate(
    ([step, ring]) => {
      if (ring) return (document.querySelector('[role="dialog"][data-tour] svg rect[stroke-width]')?.getAnimations().length ?? 0) > 0;
      const hub = document.querySelector("[data-hub]");
      const boxed = (sel) => {
        let el = hub?.querySelector(sel);
        if (el && !el.getClientRects().length && el.firstElementChild) el = el.firstElementChild;
        return el && el.getBoundingClientRect().width > 0 ? el : null;
      };
      let el = step.targets.map(boxed).find(Boolean);
      if (el && step.tap) el = el.querySelector(step.tap) ?? el;
      return !!el && el.getAnimations().length > 0;
    },
    [step, ring]
  );

let HEADERS = {};
async function session(who, opts = {}) {
  // `tour: true`: browser.js turns the tour off for every other check.
  const s = await open({ user: `zt_nd_${who}`, pass: fixture.PASSWORD, width: WIDTH, height: 844, tour: true, headers: HEADERS, ...opts });
  if (opts.notifications) await s.page.context().grantPermissions(["notifications"], { origin: s.BASE });
  return s;
}
/** The tour's steps for whoever's signed in, as the tour works them out (tour.tsx): from their Home, the catalog, and what's on
 *  their Home (a top line that goes somewhere, a show that flips, which sections there are and in what order). */
async function stepsFor(page, { solo = false, reminders = "off" } = {}) {
  const [home, catalog] = await page.evaluate(() => Promise.all([fetch("/api/me/home").then((r) => r.json()), fetch("/api/catalog").then((r) => r.json())]));
  const practice = practiceShowOf(catalog.seasons, home);
  const replay = replayOf(home);
  const here = await page.evaluate(() => {
    const hub = document.querySelector("[data-hub]");
    const boxed = (sel) => {
      let el = hub?.querySelector(sel);
      if (el && !el.getClientRects().length && el.firstElementChild) el = el.firstElementChild;
      return el && el.getBoundingClientRect().width > 0 ? el : null;
    };
    const top = {};
    for (const sel of ["[data-your-shows]", "[data-guide]", "[data-feed-list]", "[data-more-couch]"]) top[sel] = boxed(sel)?.getBoundingClientRect().top ?? null;
    return { moves: !!hub?.querySelector("a[data-status]"), flip: !!hub?.querySelector("[data-flip]"), top };
  });
  let steps = tourSteps({ solo, reminders, show: practice?.name ?? null, replay: !!replay, moves: here.moves, flip: here.flip });
  steps = steps.filter((s) => !s.optional || s.targets.some((sel) => here.top[sel] != null));
  const first = steps.findIndex((s) => s.part);
  if (first >= 0) {
    let end = first;
    while (steps[end + 1]?.part === steps[first].part) end++;
    const beats = steps.slice(first, end + 1).sort((a, b) => here.top[a.targets[0]] - here.top[b.targets[0]]);
    steps = [...steps.slice(0, first), ...beats, ...steps.slice(end + 1)];
  }
  return { steps, ...numbered(steps), practice, replay, demo: demoOf(home) };
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
    // ---- A. sam: all of it, every real thing, to Explore ----
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
        const plan = await stepsFor(page);
        const { steps, nums, of, practice, replay, demo } = plan;
        const at = (sid) => steps.findIndex((x) => x.id === sid);
        check(!!practice, "A: the catalog has a practice show for sam (Survivor, The Amazing Race or The Challenge, set up as a game)", JSON.stringify(practice));
        check(!!replay, "A: sam has a reveal to replay (a game, an episode revealed)", JSON.stringify(replay));
        check((await page.textContent("[data-tour-welcome]")).includes(`1/${of}`), `A: the welcome card, 1/${of}`);
        await shot(page, "sam-1-welcome");
        await page.click("[data-tour-go]");

        // 2: up top.
        let s = await onStep(page, steps, 1);
        stepChecks("sam", s, plan, 1);
        const y = s.scrollY;
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(400);
        check((await page.evaluate(() => window.scrollY)) === y, "A: Home doesn't scroll by hand under the tour");
        await shot(page, "sam-2-home");
        await page.click("[data-tour-next]");

        // 3: down Home, a section a beat.
        let k = 2;
        for (; steps[k].part === "down"; k++) {
          s = await onStep(page, steps, k);
          stepChecks("sam", s, plan, k);
          await shot(page, `sam-3-${steps[k].id}`);
          await page.click("[data-tour-next]");
        }
        check(k > 3, `A: down Home has its sections: ${steps.filter((x) => x.part).map((x) => x.id).join(", ")}`);

        // 4: your moves, for real.
        k = at("moves");
        s = await onStep(page, steps, k);
        stepChecks("sam", s, plan, k);
        check(!!steps[k].act, "A: sam's top line goes somewhere (results in), so the moves step goes there for real");
        if (steps[k].act) {
          await shot(page, "sam-4-moves");
          await page.click('[data-tour-act="moves"]');
          const shake = await shook(page, steps[k]);
          await page.waitForTimeout(700);
          check(shake && /\/home$/.test(page.url()) && (await tourId(page)) === "moves", "A: Your moves: Try it shakes the top line, and goes nowhere", page.url());
          const kept = [];
          const keep = (r) => r.url().includes("/api/me/tour") && r.method() === "POST" && kept.push(r.url());
          page.on("request", keep);
          await tapLit(page);
          await page.waitForURL(/\/show\//, { timeout: 12000 });
          const pill = await page.waitForSelector("[data-tour-back]", { timeout: 10000 });
          const said = (await pill.textContent()).replace(/\s+/g, " ").trim();
          check(said.includes(`${nums[k]}/${of}`) && /Back to the tour/.test(said), "A: the top line goes to its show for real, with Back to the tour on that page", said);
          await page.waitForTimeout(600);
          await shot(page, "sam-4a-moves-page");
          await page.click("[data-tour-back]");
          await page.waitForURL(/\/home$/, { timeout: 10000 });
          await ticked(page);
          check((await tourId(page)) === "moves", "A: back Home, the tour carries on from your moves, ticked");
          page.off("request", keep);
          check(kept.length === 0, "A: going to your moves isn't a skip (nothing kept)", kept.join(", "));
        } else await page.click("[data-tour-next]");

        // 5: Add a show: the tile itself, a practice.
        k = at("add");
        s = await onStep(page, steps, k);
        stepChecks("sam", s, plan, k);
        await shot(page, "sam-5-add");
        await page.click('[data-tour-act="add"]');
        const addShook = await shook(page, steps[k]);
        await page.waitForTimeout(700);
        check(addShook && !(await page.$("[role=dialog][data-open] [data-practice]")), "A: Add a show: Try it shakes the tile, and opens nothing");
        await tapLit(page);
        await page.waitForSelector("[role=dialog][data-open] [data-practice]", { timeout: 15000 });
        const typing = Date.now();
        await page.waitForFunction((name) => document.querySelector("[data-add-input]")?.value === name, practice.name, { timeout: 20000 });
        const typed = Date.now() - typing;
        check(typed >= 0.8 * (900 + (practice.name.length - 1) * 100), `A: the tile itself opens the practice, the name typed slowly enough to follow (${typed} ms for ${practice.name.length} letters)`);
        await page.waitForSelector("[data-practice-pick]", { timeout: 20000 });
        check((await page.inputValue("[data-add-input]")) === practice.name, "A: Add a show's practice types the practice show's name", await page.inputValue("[data-add-input]"));
        await shot(page, "sam-5a-typed");
        await page.click("[data-practice-pick]");
        await page.waitForSelector("[role=dialog][data-open] [data-where-save]", { timeout: 15000 });
        await page.click("[role=dialog][data-open] [data-where-save]");
        await page.waitForSelector("[data-practice-done]", { timeout: 10000 });
        const fin = await page.textContent("[data-practice-done]");
        check(fin.includes(`${practice.label} won't show up`) && /You don.t need a game to add a show/.test(fin) && /Show me$/.test(fin.trim()), "A: its finish: it won't show up; you don't need a game; Show me", fin);
        await shot(page, "sam-5b-finish");
        // Show me: the demo adds the rest by itself, each tap seen (the button ringed, then pressed in).
        const ringed = page.waitForSelector("[data-where-save][data-tour-tap]", { timeout: 60000 }).then(() => true, () => false);
        const showing = Date.now();
        await page.click("[data-practice-close]");
        await page.waitForSelector('[data-add-show="demoed"] [data-practice-done]', { timeout: 60000 });
        const showed = Date.now() - showing;
        const names = demo.map((d) => DEMO_SHOWS().find((x) => x.show.id === d.tvmazeId).show.name);
        const demoed = await page.textContent("[data-practice-done]");
        check(names.every((n) => demoed.includes(n)) && demoed.includes("won't show up either"), `A: Show me: the tour adds ${names.join(" and ")} by itself, and says they won't show up either`, demoed);
        check(showed >= 6000 * names.length, `A: the demo slow enough to follow (${Math.round(showed / 100) / 10} s for ${names.length} shows)`);
        check(await ringed, "A: the demo's Add to my shows ringed and pressed before it's tapped");
        await shot(page, "sam-5c-demoed");
        await page.click("[data-practice-close]");
        await ticked(page);

        // 6: Flip a show: the corner, for real.
        k = at("flip");
        check(k > 0, "A: sam's show turns over to sam's games, so there's a flip step");
        if (k > 0) {
          s = await onStep(page, steps, k);
          stepChecks("sam", s, plan, k);
          const shelf = await page.$$eval("[data-poster]", (p) => p.map((x) => x.getAttribute("data-poster")));
          check(demo.every((d) => shelf.includes(`tour-${d.tvmazeId}`)), "A: Your shows has the demo's shows for now", shelf.join(", "));
          await shot(page, "sam-6-flip");
          await page.click('[data-tour-act="flip"]');
          const flipShook = await shook(page, steps[k]);
          await page.waitForTimeout(600);
          check(flipShook && !(await page.$("[data-hub] [data-flipped]")), "A: Flip a show: Try it shakes the corner, and turns nothing");
          await tapLit(page);
          const turned = await page.waitForSelector("[data-hub] [data-flipped]", { timeout: 4000 }).then(() => true, () => false);
          await page.waitForTimeout(900);
          await shot(page, "sam-6a-flipped");
          const back = await page.waitForFunction(() => !document.querySelector("[data-hub] [data-flipped]"), null, { timeout: 8000 }).then(() => true, () => false);
          check(turned && back, "A: the tap turns the show over to sam's games, then back");
          await ticked(page);
        }

        // 7: the TV guide: the demo's game in it, its filters through the tour, Sports soon.
        k = at("guide");
        s = await onStep(page, steps, k);
        stepChecks("sam", s, plan, k);
        await page.waitForTimeout(800);
        const nfl = demo.find((d) => d.tvmazeId !== 68803);
        const cards = await page.$$eval("[data-guide-card]", (c) => c.map((x) => x.getAttribute("aria-label") ?? ""));
        const nflName = nfl && DEMO_SHOWS().find((x) => x.show.id === nfl.tvmazeId).show.name;
        check(!nfl || cards.some((c) => c.startsWith(nflName)), `A: the guide has the demo's game (${nflName})`, cards.join(" | "));
        check(!!(await page.$("[data-guide-reel]")) && (await page.evaluate(() => document.querySelector("[data-guide-reel]").scrollLeft)) < 8, "A: the guide's held on today");
        await shot(page, "sam-7-guide");
        await tapAt(page, "[data-guide-tv-soon]");
        const soon = await page.waitForFunction(() => /Sports are coming soon/.test(document.querySelector("[data-toast]")?.textContent ?? ""), null, { timeout: 4000 }).then(() => true, () => false);
        // (Left on All TV: this browser's own setting, gone with it.)
        await tapAt(page, '[data-guide-tv-choice="all"]');
        await page.waitForTimeout(400);
        const all = await page.getAttribute("[data-guide-tv]", "data-guide-tv");
        check(soon && all === "all" && (await tourId(page)) === "guide", "A: the TV guide's filters work through the tour, and Sports says it's coming", `${soon} ${all}`);
        await page.click("[data-tour-next]");

        // 8: the reveal, replayed.
        k = at("reveal");
        s = await onStep(page, steps, k);
        stepChecks("sam", s, plan, k);
        const shelfAfter = await page.$$eval("[data-poster]", (p) => p.map((x) => x.getAttribute("data-poster")));
        check(!shelfAfter.some((x) => x.startsWith("tour-")), "A: past the guide, the demo's shows are off Home", shelfAfter.join(", "));
        await shot(page, "sam-8-reveal");
        await page.click('[data-tour-act="reveal"]');
        const revealShook = await shook(page, steps[k]);
        await page.waitForTimeout(600);
        check(revealShook && !(await page.$("[data-tour-reveal]")), "A: the reveal: Try it shakes Reveal, and plays nothing");
        await tapLit(page);
        await page.waitForSelector('[data-tour-reveal="replay"] [data-beat]', { timeout: 20000 });
        await shot(page, "sam-8a-replay");
        for (let j = 0; j < 8 && !(await page.$("[data-tour-reveal-done]")); j++) {
          await page.click("[data-tour-reveal] [data-stage]");
          await page.waitForTimeout(350);
        }
        const end = await page.textContent("[data-tour-reveal]");
        check(!!(await page.$("[data-tour-reveal-done]")) && !/Share your night/.test(end) && !/Reveal Episode/.test(end), "A: the replay ends on Back to the tour: no Share your night, no next episode");
        await page.click("[data-tour-reveal-done]");
        await ticked(page);

        // 9: Start a game, practice: the Prediction Sheet, Start it always in sight.
        k = at("start");
        s = await onStep(page, steps, k);
        stepChecks("sam", s, plan, k);
        await shot(page, "sam-9-start");
        await tapLit(page);
        await page.waitForSelector(`[data-pick-practice][data-pick-show="${practice.seasonId}"]`, { timeout: 15000 });
        check(true, "A: Start a game's practice offers the practice show first");
        // Another show of sam's: the practice row shakes, and nothing else opens.
        if (await page.$("[data-start-pick] [data-pick-show]:not([data-pick-practice])")) {
          await page.click("[data-start-pick] [data-pick-show]:not([data-pick-practice])");
          const row = await page.evaluate(() => (document.querySelector("[data-pick-practice]")?.getAnimations().length ?? 0) > 0);
          await page.waitForTimeout(600);
          check(row && !!(await page.$("[data-start-pick] [data-pick-practice]")) && !(await page.$("[data-start-sheet]")), "A: in practice, another show shakes the practice show's row, and opens nothing");
        }
        await page.click("[data-pick-practice]");
        const warmed = await page.waitForSelector("[data-start-warming]", { timeout: 6000 }).then(() => true, () => false);
        check(warmed, "A: picking it, a moment getting its rules");
        await page.waitForSelector("[data-start-go]", { timeout: 30000 });
        check((await page.getAttribute('[data-start-game="questions"]', "aria-pressed")) === "true", "A: the Prediction Sheet chosen");
        check(!!(await page.$("[data-coming-soon-ai]")), "A: Create a game with AI, coming soon, in the sheet");
        const go = await page.$eval("[role=dialog][data-open] [data-start-go]", (el) => {
          const r = el.getBoundingClientRect();
          return { foot: !!el.closest("[data-sheet-foot]"), seen: r.top >= 0 && r.bottom <= window.innerHeight };
        });
        check(go.foot && go.seen, "A: Start it sits in the sheet's foot, in sight without scrolling", JSON.stringify(go));
        await shot(page, "sam-9a-options");
        await page.click("[data-start-go]");
        await page.waitForSelector("[data-practice-done]", { timeout: 10000 });
        const started = await page.textContent("[data-practice-done]");
        check(/Prediction Sheet .* won't show up/.test(started) && !!(await page.$("[data-practice-done] [data-coming-soon-ai]")), "A: its finish: it won't show up, and the AI's coming", started);
        await page.click("[data-practice-close]");
        await ticked(page);

        // 10: you're set: reminders, Explore.
        k = steps.length - 1;
        s = await onStep(page, steps, k);
        stepChecks("sam", s, plan, k);
        check(!!(await page.$("[data-tour-on]")) && !!(await page.$("[data-tour-explore]")), "A: the last step: Turn on reminders · Explore");
        await shot(page, "sam-10-done");
        const status = await endWith(page, () => page.click("[data-tour-explore]"));
        check(status === 200 && /your picture to take the tour again/.test((await page.textContent('[data-toast="done"]').catch(() => "")) ?? ""), "A: Explore ends it, and says where it lives", String(status));
        const row = await tourOf(pool, U.sam);
        check(!!row.tour_seen_at && row.tour_reached === of, `A: kept for the account, to the last step (${of})`, JSON.stringify(row));

        // Nothing written by any practice.
        const bad = writes.filter((w) => /^\/api\/me\/shows|^\/api\/me\/follows\/|^\/api\/seasons\/[^/]+\/start$/.test(w.u) || (/\/reveal$/.test(w.u) && !/"replay":true/.test(w.b)));
        check(bad.length === 0, "A: no practice wrote anything (no add, follow, start, or reveal but a replay)", bad.map((w) => `${w.m} ${w.u}`).join(", "));
        check(writes.some((w) => /\/reveal$/.test(w.u)), "A: the replay asked the server (with replay: true)");
        const after = await rowsOf(pool, U.sam);
        for (const key of Object.keys(before)) check(before[key] === after[key], `A: sam's ${key} as they were`, `${before[key]} → ${after[key]}`);
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

    // ---- E. solo: no Start a game practice, no flip, a made-up reveal, Turn on ends it ----
    {
      const { page, errors: e, BASE, close } = await session("solo", { notifications: true });
      const reveals = [];
      page.on("request", (r) => /\/reveal$/.test(new URL(r.url()).pathname) && reveals.push(r.url()));
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-hub="solo"]', { timeout: 15000 });
        await welcome(page);
        const plan = await stepsFor(page, { solo: true });
        const { steps, of } = plan;
        check(!steps.find((x) => x.id === "start").act && !steps.find((x) => x.id === "flip"), "E: no Start a game practice and no flip for a solo player");
        await page.click("[data-tour-go]");
        for (let k = 1; k < steps.length; k++) {
          const s = await onStep(page, steps, k);
          stepChecks("solo", s, plan, k);
          if (steps[k].id === "reveal") {
            await tapLit(page);
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
        check(!!row.tour_seen_at && row.tour_reached === of, "E: Turn on reminders ends it, kept", JSON.stringify(row));
      } finally {
        // Turn on asks the browser for a push subscription, which a headless one may refuse: that's the reminder's own toast.
        errors.push(...e.filter((x) => !/push|subscri|service ?worker/i.test(x)).map((x) => `E: ${x}`));
        await close();
      }
    }

    // ---- F. riley, reduced motion: lit at once; Try it only blinks the ring; the rules' moment still shows ----
    {
      const { page, errors: e, BASE, close } = await session("riley", { motion: "reduce", notifications: true });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await welcome(page);
        const { steps } = await stepsFor(page);
        await page.click("[data-tour-go]");
        let ok = true;
        let blinked = null;
        for (let k = 1; k < steps.length; k++) {
          const t0 = Date.now();
          const s = await onStep(page, steps, k);
          ok &&= Date.now() - t0 < 2500 && ringFits(s);
          if (steps[k].act && blinked === null) {
            await page.click("[data-tour-act]");
            blinked = (await shook(page, steps[k], true)) && !(await shook(page, steps[k]));
          }
          if (steps[k].id === "start") {
            await tapLit(page);
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
        check(blinked === true, "F: reduced motion: Try it blinks the ring and moves nothing");
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

    // ---- J. the real Start a game sheet: Create a game with AI, coming soon; Start it in sight ----
    {
      const { page, errors: e, BASE, close } = await open({ user: "zt_nd_alex", pass: fixture.PASSWORD, width: WIDTH, height: 844, headers: HEADERS });
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await page.click("[data-foot-start]", { timeout: 20000 });
        await page.click("[data-pick-show]", { timeout: 10000 });
        await page.waitForSelector("[data-start-go]", { timeout: 30000 });
        check(!!(await page.$("[role=dialog][data-open] [data-coming-soon-ai]")) && !(await page.$("[data-practice]")), "J: the real Start a game sheet: Create a game with AI, coming soon (and no Practice strip)");
        const go = await page.$eval("[role=dialog][data-open] [data-start-go]", (el) => {
          const r = el.getBoundingClientRect();
          return { foot: !!el.closest("[data-sheet-foot]"), seen: r.top >= 0 && r.bottom <= window.innerHeight };
        });
        check(go.foot && go.seen, "J: Start it in the sheet's foot, in sight without scrolling, for everyone", JSON.stringify(go));
        await shot(page, "start-game-ai");
      } finally {
        errors.push(...e.map((x) => `J: ${x}`));
        await close();
      }
    }

    // ---- L. jordan: a step with a real thing to tap: Try it at the thumb's spot only shakes it, and a stray tap doesn't skip it ----
    {
      const { page, errors: e, BASE, close } = await session("jordan");
      try {
        await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
        await welcome(page);
        const plan = await stepsFor(page);
        const { steps, nums } = plan;
        await page.click("[data-tour-go]");
        await onStep(page, steps, 1);
        // Where a thumb taps Next on a step with nothing to do.
        const nextAt = await page.$eval("[data-tour-next] > span:last-child", (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent.trim() };
        });
        check(nextAt.text === "Next", "L: a step with nothing to do: the plate says Next", nextAt.text);
        const k = steps.findIndex((x) => x.act);
        for (let j = 1; j < k; j++) {
          await onStep(page, steps, j);
          await page.click("[data-tour-next]");
        }
        const s = await onStep(page, steps, k);
        const url = page.url();
        await page.mouse.click(nextAt.x, nextAt.y);
        const thumb = await shook(page, steps[k]);
        await page.waitForTimeout(1000);
        const says = await page.$eval("[data-tour-act] > span:last-child", (el) => el.textContent.trim());
        check(
          s.act === steps[k].act.kind && says === "Try it" && thumb && page.url() === url && (await tourId(page)) === steps[k].id && !(await page.$("[role=dialog][data-open] [data-practice]")),
          `L: ${steps[k].id}: the plate says Try it, and a tap where Next was shakes the thing to tap and does nothing else`,
          JSON.stringify({ says, thumb, url: page.url() })
        );
        check(s.skip === steps[k].act.skip, `L: its skip says "${steps[k].act.skip}", up by Skip tour`, s.skip);
        await shot(page, "jordan-try-it");
        // A tap on the dimmed page, away from what's lit and the lower third: a shake, not a skip.
        const off = { x: 24, y: s.ring.y + s.ring.h + 40 < s.lowerTop - 20 ? s.ring.y + s.ring.h + 40 : Math.max(8, s.ring.y - 40) };
        await page.mouse.click(off.x, off.y);
        const stray = await shook(page, steps[k]);
        await page.waitForTimeout(1000);
        check(stray && (await tourId(page)) === steps[k].id, "L: a tap anywhere else shakes it too, and stays", String(await tourId(page)));
        await page.click("[data-tour-next]");
        const s2 = await onStep(page, steps, k + 1);
        check(s2.id === steps[k + 1].id, `L: the skip moves on, to ${steps[k + 1].id}`, s2.id);
        await endWith(page, () => page.keyboard.press("Escape"));
        const row = await tourOf(pool, U.jordan);
        check(row.tour_reached === nums[k + 1], `L: kept as seen to step ${nums[k + 1]}`, JSON.stringify(row));
      } finally {
        errors.push(...e.map((x) => `L: ${x}`));
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
