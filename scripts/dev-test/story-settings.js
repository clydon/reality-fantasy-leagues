// The settings overhaul's frames (docs/PLAN-settings-overhaul.md, Round 0; the audit: docs/design-round/settings-audit.md): every
// settings place in the app, in the roles that see it, shot at a phone's size for the round's screenshot story. One list serves
// before and after: a missing selector is skipped, not failed, so the same ids can be shot again once a round has built.
//
// The people (new-fixture.js's zt_nd couch, solo-fixture.js, and a site admin made here):
//   alex     owns the couch, runs its three Survivor games (Commissioner), and is on a second couch (ZT Extra) with casey
//   riley    a Game admin in the lineup game; follows ZT Traitors 5 openly (through Episode 2), a show they don't play
//   jordan   a player; follows ZT Traitors 5 privately (through 4)
//   sam      a player two episodes behind (through 3)
//   zt_so_alex  on no couch (solo)
//   zt_nd_desk  a site admin, for the desk's frames (removed with the zt_nd people by new-fixture's down)
//
// Situations by id (--only=<regex on the id>), grouped by what the settings are about:
//   you-*      your Settings (whole page as alex, jordan, solo; each fold open), your profile, the hub's sheet
//   show-*     a show's ⋯ menu (a runner, a player), Everything else, its Notifications, Where you are (a show you only
//              follow; a show you play, behind)
//   couch-*    Your couches, a couch's sheet (its owner, a member)
//   game-*     a game's ⋯ (a player), a game's settings (its Commissioner, a Game admin)
//   run-*      Backstage's home and pages (Results, Waivers, Scoring rules, Members & roles, Game settings, Recent changes)
//   desk-*     the desk's Settings tab and a season's Setup, as the site admin
//   r1-*       settings Round 1, as built (docs/design-round/settings-r1-spec.md): Your settings in each phone state (off and nothing
//              reaches you, on, another phone gets them, blocked, an iPhone in Safari), solo, the site admin; its pages
//              (Notifications, When results show, Privacy, Your shows couches and games, Your account, Your phones, Install the
//              app); a show's Notifications (mute, muted); a couch's chat row; the hub's gear and the bell's foot
// A situation can set this phone up (`init`: stand-ins for the browser's PushManager and permission, never a real push service),
// put rows in first and take them out after (`db`, `undo`: zt_nd_ people only), and scroll a part into view before the frame
// (`scroll`).
// For each it keeps <id>.jpg (the first view), <id>.full.jpg (unless first-view only), <id>.txt (the page's words) and prints
// OVERLAP lines (words over words: overlaps.js), then index.json (each id with its who, where and lens).
//
// Needs: the app (BASE in .env.local; in the settings lane, `node scripts/lane.js dev settings`). Brings the fixtures up and takes
// them down after unless --keep. zt_nd_ and zt_so_ rows only; refuses a non-local database. Shares new-fixture's zt_nd couch:
// never run beside another check on it.
// Run:   node scripts/dev-test/story-settings.js [--out=.ui-atlas/stories/settings-r0/before] [--width=390 --height=844] [--only=<regex>] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./new-fixture");
const solo = require("./solo-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const OUT = path.resolve(opt("out", ".ui-atlas/stories/settings-r0/before"));
const ONLY = opt("only", null);
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-settings runs against a local database only");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DESK = "zt_nd_desk";
/** A name on the zt_nd couch ("alex"), or a whole zt_ username ("zt_so_alex", "zt_nd_desk"). */
const userOf = (who) => (who.startsWith("zt_") ? who : fixture.username(who));

async function frame(page, x) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, `${x.id}.jpg`), type: "jpeg", quality: 84 });
  // A page pushed over the screen (ui/page.tsx) scrolls inside a fixed layer: for the whole-page frame, let it grow and hide the
  // screen under it, so the frame is that page alone.
  if (x.full !== false)
    await page.evaluate(() => {
      const pushed = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].find((d) => d.getAttribute("aria-hidden") !== "true" && d.classList.contains("fixed"));
      if (!pushed) return;
      for (const c of document.body.children) if (c !== pushed && !c.contains(pushed)) c.style.display = "none";
      Object.assign(pushed.style, { position: "relative", height: "auto", overflow: "visible", inset: "auto" });
    });
  if (x.full !== false) await page.screenshot({ path: path.join(OUT, `${x.id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  fs.writeFileSync(path.join(OUT, `${x.id}.txt`), await page.evaluate(() => document.body.innerText));
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${x.id}: "${a}" on "${b}"`);
  console.log(`PASS ${x.id}`);
}

/** A tap: a CSS selector, or { text } for a button or row by its exact words. */
function target(page, t) {
  return typeof t === "string" ? page.locator(t).first() : page.getByText(t.text, { exact: true }).first();
}

async function shoot(list) {
  let failed = 0;
  const shot = [];
  for (const x of list.filter((x) => !ONLY || new RegExp(ONLY).test(x.id))) {
    if (x.db) await x.db();
    const b = await open({ user: userOf(x.who), pass: fixture.PASSWORD, width: W, height: H, motion: "reduce" });
    try {
      for (const [fn, arg] of x.init ?? []) await b.page.context().addInitScript(fn, arg);
      if (x.perm) await b.page.context().grantPermissions(["notifications"], { origin: b.BASE });
      await b.page.goto(b.BASE + x.go, { waitUntil: "networkidle", timeout: 90000 });
      await b.page.locator(x.ready).first().waitFor({ timeout: 45000 });
      await sleep(1500);
      let skipped = false;
      for (const t of x.tap ? (Array.isArray(x.tap) ? x.tap : [x.tap]) : []) {
        const el = target(b.page, t);
        if (!(await el.count())) {
          console.log(`(skip ${x.id}: no ${typeof t === "string" ? t : t.text})`);
          skipped = true;
          break;
        }
        await el.click();
        await sleep(1200);
      }
      if (skipped) continue;
      if (x.wait) await b.page.locator(x.wait).first().waitFor({ timeout: 20000 }).catch(() => console.log(`(no ${x.wait} in ${x.id})`));
      if (x.scroll) await b.page.locator(x.scroll).first().scrollIntoViewIfNeeded().catch(() => console.log(`(no ${x.scroll} in ${x.id})`));
      await frame(b.page, x);
      shot.push({ id: x.id, who: x.who, go: x.go, home: x.home, lens: x.lens });
      if (b.errors.length) console.log(`ERRORS ${x.id}: ${b.errors.slice(0, 3).join(" | ")}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${x.id}: ${e.message.split("\n")[0]}`);
      await b.page.screenshot({ path: path.join(OUT, `${x.id}.fail.jpg`), type: "jpeg" }).catch(() => {});
    } finally {
      await b.close();
      if (x.undo) await x.undo().catch((e) => console.log(`(undo ${x.id}: ${e.message})`));
    }
  }
  return { failed, shot };
}

// ---------- settings Round 1 ----------

/** This phone, on: a stand-in PushManager whose subscription is `endpoint` (never a real push service; nothing is pushed). */
const phoneOn = (endpoint) => {
  const make = () => ({ endpoint, expirationTime: null, toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "zt", auth: "zt" } }), unsubscribe: async () => true });
  PushManager.prototype.subscribe = async () => make();
  PushManager.prototype.getSubscription = async () => make();
  // A test browser is new: the app's service worker isn't registered yet when the page first asks, as a real phone's would be.
  const reg = { pushManager: { subscribe: async () => make(), getSubscription: async () => make() } };
  navigator.serviceWorker.getRegistration = async () => reg;
};
/** This phone, blocked by the browser. */
const phoneBlocked = () => Object.defineProperty(Notification, "permission", { get: () => "denied" });
/** An iPhone in Safari, not on the Home Screen: no PushManager at all. */
const onIphone = () => {
  Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  delete window.PushManager;
};
const ENDPOINT = (who) => `http://127.0.0.1:9/zt-r1/${who}`;
const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};

/** Round 1's situations (r1-*): the built Your settings and notifications, each in the state its caption names. */
function round1(pool, fx, S, T, menu, sheet) {
  const U = fx.users;
  const groups = "[data-settings-groups]";
  const show = async () => (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [S])).rows[0].show_id;
  const sub = (who, ua, endpoint = `${ENDPOINT(who)}-${Math.random().toString(36).slice(2, 7)}`, sent = true) =>
    pool.query(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_success_at) VALUES ($1, $2, 'zt', 'zt', $3, ${sent ? "now() - interval '2 days'" : "NULL"})`, [U[who], endpoint, ua]);
  const noSubs = (...who) => pool.query("DELETE FROM push_subscriptions WHERE user_id = ANY($1::text[])", [who.map((w) => U[w])]);
  const prefs = (who, muted) =>
    pool.query(`INSERT INTO notification_prefs (user_id, muted) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET muted = EXCLUDED.muted`, [U[who], JSON.stringify(muted)]);
  const noPrefs = (who) => pool.query("UPDATE notification_prefs SET muted = '{}'::jsonb WHERE user_id = $1", [U[who]]);
  const couchChat = (who, couchId, chat) => pool.query("UPDATE couch_members SET chat_notify = $3 WHERE couch_id = $1 AND user_id = $2", [couchId, U[who], chat]);
  // jordan with this phone on, Survivor muted for a week and ZT Survivor 51's chat on Never: what's set elsewhere, listed.
  const jordanOn = async () => {
    await sub("jordan", UA.android, ENDPOINT("jordan"));
    await prefs("jordan", { [await show()]: new Date(Date.now() + 7 * 86400000).toISOString() });
    await couchChat("jordan", fx.couchId, "off");
  };
  const jordanOff = async () => {
    await noSubs("jordan");
    await noPrefs("jordan");
    await couchChat("jordan", fx.couchId, null);
  };
  const on = [[phoneOn, ENDPOINT("jordan")]];
  return [
    // Your settings, first view and whole page, in each phone state
    { id: "r1-you-alex", home: "you", who: "alex", go: "/settings", ready: groups, lens: "alex: runs three games, on two couches; this phone off and no other phone gets them (the plate)" },
    { id: "r1-you-jordan-on", home: "you", who: "jordan", go: "/settings", ready: groups, init: on, perm: true, db: jordanOn, undo: jordanOff, lens: "jordan: this phone on; Survivor muted, one couch's chat set apart" },
    { id: "r1-you-other-alex", home: "you", who: "alex", go: "/settings", ready: groups, db: () => sub("alex", UA.iphone), undo: () => noSubs("alex"), lens: "alex: this phone off, but his iPhone gets them (no plate)" },
    { id: "r1-you-blocked-alex", home: "you", who: "alex", go: "/settings", ready: groups, init: [[phoneBlocked, null]], full: false, lens: "alex: notifications blocked by the browser" },
    { id: "r1-you-iphone-alex", home: "you", who: "alex", go: "/settings", ready: groups, init: [[onIphone, null]], full: false, lens: "alex on an iPhone in Safari, not on the Home Screen" },
    { id: "r1-you-solo", home: "you", who: "zt_so_alex", go: "/settings", ready: groups, lens: "solo: on no couch (no Privacy, no couch kinds)" },
    { id: "r1-you-desk", home: "you", who: DESK, go: "/settings", ready: groups, lens: "the site admin: Site admin above Sign out" },
    { id: "r1-appearance-alex", home: "you", who: "alex", go: "/settings", ready: groups, tap: '[data-fold="appearance"] button', full: false, lens: "Appearance, opened in place" },
    // Its pages
    { id: "r1-notify-alex", home: "you", who: "alex", go: "/settings?page=notifications", ready: "[data-settings-notify]", lens: "Notifications: this phone off, nothing reaches him (the kinds read as off)" },
    { id: "r1-notify-jordan-on", home: "you", who: "jordan", go: "/settings?page=notifications", ready: "[data-settings-notify]", init: on, perm: true, db: jordanOn, undo: jordanOff, lens: "Notifications: on, with a muted show and a couch's own chat" },
    { id: "r1-notify-off-jordan", home: "you", who: "jordan", go: "/settings?page=notifications", ready: "[data-settings-notify]", init: on, perm: true, db: async () => { await jordanOn(); await pool.query(`UPDATE notification_prefs SET disabled = '{"episodeResults":true,"finalScores":true,"betResult":true,"flagSettled":true,"researchDone":true,"resultsChanged":true}'::jsonb WHERE user_id = $1`, [U.jordan]); }, undo: async () => { await jordanOff(); await pool.query("UPDATE notification_prefs SET disabled = '{}'::jsonb WHERE user_id = $1", [U.jordan]); }, full: false, lens: "Notifications: Results off, its line says what's left (the bell)" },
    { id: "r1-results-riley", home: "you", who: "riley", go: "/settings?page=results", ready: "[data-settings-results]", lens: "When results show: riley follows The Traitors without playing it" },
    { id: "r1-results-ask-alex", home: "you", who: "alex", go: "/settings?page=results", ready: "[data-settings-results]", tap: '[data-choice="hide-off"]', wait: "[data-hide-warn]", full: false, lens: "Straight away asks first: Undo can't unsee a result" },
    { id: "r1-privacy-alex", home: "you", who: "alex", go: "/settings?page=privacy", ready: "[data-settings-sharing]", lens: "Privacy: one switch, and what riley sees" },
    { id: "r1-privacy-jordan", home: "you", who: "jordan", go: "/settings?page=privacy", ready: "[data-settings-sharing]", full: false, lens: "Privacy: jordan hides The Traitors from the couch" },
    { id: "r1-yours-alex", home: "you", who: "alex", go: "/settings?page=yours", ready: "[data-settings-yours]", lens: "Your shows, couches and games: the map of what's set where" },
    { id: "r1-yours-jordan-on", home: "you", who: "jordan", go: "/settings?page=yours", ready: "[data-settings-yours]", db: jordanOn, undo: jordanOff, full: false, lens: "Your shows, couches and games: Survivor muted, a couch's chat on Never" },
    { id: "r1-account-alex", home: "you", who: "alex", go: "/settings?page=account", ready: "[data-settings-account]", lens: "Your account" },
    { id: "r1-phones-alex", home: "you", who: "alex", go: "/settings?page=phones", ready: "[data-settings-phones]", init: [[phoneOn, ENDPOINT("alex")]], perm: true, db: async () => { await sub("alex", UA.android, ENDPOINT("alex")); await sub("alex", UA.iphone); await sub("alex", UA.mac, undefined, false); }, undo: () => noSubs("alex"), lens: "Your phones: three get notifications, this one marked" },
    { id: "r1-phones-ask-alex", home: "you", who: "alex", go: "/settings?page=phones", ready: "[data-settings-phones]", tap: "[data-sign-out-others]", init: [[phoneOn, ENDPOINT("alex")]], perm: true, db: async () => { await sub("alex", UA.android, ENDPOINT("alex")); await sub("alex", UA.iphone); await pool.query(`INSERT INTO session (id, "userId", token, "expiresAt", "createdAt", "updatedAt", "userAgent") VALUES ($1, $2, $3, now() + interval '20 days', now() - interval '3 days', now() - interval '3 days', $4)`, [crypto.randomUUID(), U.alex, crypto.randomUUID(), UA.iphone]); }, undo: async () => { await noSubs("alex"); await pool.query(`DELETE FROM session WHERE "userId" = $1 AND "userAgent" = $2`, [U.alex, UA.iphone]); }, full: false, lens: "Sign out everywhere else: a sentence first" },
    { id: "r1-allow-blocked", home: "you", who: "alex", go: "/settings", ready: groups, init: [[phoneBlocked, null]], tap: "[data-phone-plate] [data-phone-allow]", wait: "[data-allow-sheet]", full: false, lens: "blocked: Show me how, the steps to allow them in this browser" },
    { id: "r1-install-iphone", home: "you", who: "alex", go: "/settings", ready: groups, init: [[onIphone, null]], tap: "[data-phone-plate] [data-phone-install]", wait: "[data-install-sheet]", full: false, lens: "Install the app, from the plate on an iPhone" },
    // Notifications beyond Your settings
    { id: "r1-hub-alex", home: "you", who: "alex", go: "/home", ready: "[data-hub]", full: false, lens: "the hub: the gear between the bell and your picture" },
    { id: "r1-hubsheet-alex", home: "you", who: "alex", go: "/home", ready: "[data-hub]", tap: '[data-tour="you"]', wait: sheet, full: false, lens: "your picture's sheet: your couch and numbers, a quiet Your settings row" },
    { id: "r1-bell-alex", home: "you", who: "alex", go: "/home", ready: "[data-hub]", tap: "[data-bell]", wait: "[data-notes-sheet]", scroll: "[data-notes-settings]", full: false, lens: "the bell: Notification settings at its foot" },
    { id: "r1-show-notify-jordan", home: "show", who: "jordan", go: `/show/${S}/tonight`, ready: menu, tap: [menu, { text: "Notifications" }], wait: "[data-show-notify]", init: on, perm: true, db: () => sub("jordan", UA.android, ENDPOINT("jordan")), undo: () => noSubs("jordan"), full: false, lens: "a show's Notifications: Mute first, with what still comes" },
    { id: "r1-show-mute-jordan", home: "show", who: "jordan", go: `/show/${S}/tonight?notify=1`, ready: "[data-show-notify]", tap: "[data-mute]", wait: "[data-mute-choices]", init: on, perm: true, db: () => sub("jordan", UA.android, ENDPOINT("jordan")), undo: () => noSubs("jordan"), full: false, lens: "Mute, opened: a day, a week, or until I turn it back on (opened by the push's link)" },
    { id: "r1-show-muted-jordan", home: "show", who: "jordan", go: `/show/${S}/tonight?notify=1`, ready: "[data-show-notify]", init: on, perm: true, db: jordanOn, undo: jordanOff, full: false, lens: "muted for a week: Unmute is the one action, and reminders still come" },
    { id: "r1-couch-chat-alex", home: "couch", who: "alex", go: "/settings?page=yours", ready: "[data-settings-yours]", tap: ['[data-yours-couch="ZT Extra"]', "[data-couch-chat] button"], wait: "[data-couch-chat]", scroll: "[data-couch-chat]", full: false, lens: "a couch's page: Chat notifications on ZT Extra, opened" },
  ];
}

/** The site admin for the desk's frames: a zt_nd_ person, so new-fixture's down removes them with the rest. */
async function deskAdmin(pool) {
  const { hashPassword } = await import("better-auth/crypto");
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, $2, $2, 'admin', true, now(), now())`,
    [id, DESK, `${DESK}@example.invalid`]
  );
  await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    crypto.randomUUID(),
    id,
    await hashPassword(fixture.PASSWORD),
  ]);
  return id;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  let failed = 0;
  const index = [];
  try {
    const fx = await fixture.up(pool);
    await solo.up(pool);
    const deskId = await deskAdmin(pool);
    // Everyone on the new design (a fixture person can start on classic).
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    const S = fx.seasonId, T = fx.traitorsSeasonId, L = fx.leagues;
    const menu = 'button[aria-label^="Show menu"]';
    const sheet = '[role="dialog"]';
    const r = await shoot([
      // You
      { id: "you-settings-alex", home: "you", who: "alex", go: "/settings", ready: "[data-fold]", lens: "a runner on two couches, notifications off on this phone" },
      { id: "you-settings-jordan", home: "you", who: "jordan", go: "/settings", ready: "[data-fold]", lens: "a player who follows a show privately" },
      { id: "you-settings-solo", home: "you", who: "zt_so_alex", go: "/settings", ready: "[data-fold]", lens: "solo: on no couch" },
      { id: "you-notify-alex", home: "you", who: "alex", go: "/settings", ready: "[data-fold]", tap: '[data-fold="notify"] button', full: false, lens: "Which notifications, open" },
      { id: "you-sharing-alex", home: "you", who: "alex", go: "/settings", ready: "[data-fold]", tap: { text: "What your couch sees" }, full: false, lens: "What your couch sees, open" },
      { id: "you-moveon-riley", home: "you", who: "riley", go: "/settings", ready: "[data-fold]", tap: '[data-fold="auto"] button', full: false, lens: "Shows that move along by themselves, open (riley follows a show she doesn't play)" },
      { id: "you-ai-alex", home: "you", who: "alex", go: "/settings", ready: "[data-fold]", tap: '[data-fold="ai"] button', full: false, lens: "Your AI for results, open (runners only)" },
      { id: "you-account-alex", home: "you", who: "alex", go: "/settings", ready: "[data-fold]", tap: '[data-fold="account"] button', full: false, lens: "Your account, open" },
      { id: "you-profile-alex", home: "you", who: "alex", go: "/settings", ready: "[data-fold]", tap: { text: "Edit" }, wait: sheet, full: false, lens: "Your profile (Edit)" },
      { id: "you-hubsheet-alex", home: "you", who: "alex", go: "/home", ready: "[data-hub]", tap: '[data-tour="you"]', wait: sheet, full: false, lens: "the hub's sheet: your picture, the only door to Settings" },
      // A show
      { id: "show-menu-alex", home: "show", who: "alex", go: `/show/${S}/tonight`, ready: menu, tap: menu, wait: sheet, full: false, lens: "the show's ⋯ as its games' runner" },
      { id: "show-menu-jordan", home: "show", who: "jordan", go: `/show/${S}/tonight`, ready: menu, tap: menu, wait: sheet, full: false, lens: "the show's ⋯ as a player" },
      { id: "show-else-jordan", home: "show", who: "jordan", go: `/show/${S}/tonight`, ready: menu, tap: [menu, { text: "Everything else" }], wait: sheet, full: false, lens: "Everything else, a sheet inside the menu" },
      { id: "show-notify-jordan", home: "show", who: "jordan", go: `/show/${S}/tonight`, ready: menu, tap: [menu, { text: "Notifications" }], wait: sheet, full: false, lens: "Notifications for this show" },
      { id: "show-where-riley", home: "show", who: "riley", go: `/show/${T}/episodes`, ready: "[data-progress-compact]", tap: "[data-progress-compact]", wait: sheet, full: false, lens: "Where you are, on a show riley only follows" },
      { id: "show-where-sam", home: "show", who: "sam", go: `/show/${S}/episodes`, ready: "[data-progress-compact]", tap: "[data-progress-compact]", wait: sheet, full: false, lens: "Where you are, on a show sam plays, two behind" },
      // A couch
      { id: "couch-switch-alex", home: "couch", who: "alex", go: "/home", ready: "[data-hub]", tap: ['[data-tour="you"]', "[data-couch-line]"], wait: "[data-couch-switcher]", full: false, lens: "Your couches (two)" },
      // A couch row in the switcher switches the hub to it; its details open from the "<couch> details" row just under the list.
      { id: "couch-details-alex", home: "couch", who: "alex", go: "/home", ready: "[data-hub]", tap: ['[data-tour="you"]', "[data-couch-line]", { text: "ZT Survivor 51 details" }], wait: "[data-couch-details]", full: false, lens: "a couch's sheet, as its owner" },
      { id: "couch-details-riley", home: "couch", who: "riley", go: "/home", ready: "[data-hub]", tap: ['[data-tour="you"]', "[data-couch-line]", { text: "ZT Survivor 51 details" }], wait: "[data-couch-details]", full: false, lens: "a couch's sheet, as a member" },
      // A game
      { id: "game-menu-jordan", home: "game", who: "jordan", go: `/show/${S}/game/${L.lineup}`, ready: "[data-game-page]", tap: "[data-game-title] [data-game-menu-open]", wait: sheet, full: false, lens: "a game's ⋯, as a player" },
      { id: "game-settings-alex", home: "game", who: "alex", go: `/show/${S}/game/${L.lineup}`, ready: "[data-game-page]", tap: ["[data-game-title] [data-game-menu-open]", '[data-game-menu] :text-is("Game settings")'], wait: "[data-game-settings]", lens: "a game's settings, its Commissioner" },
      { id: "game-settings-riley", home: "game", who: "riley", go: `/show/${S}/game/${L.lineup}`, ready: "[data-game-page]", tap: ["[data-game-title] [data-game-menu-open]", '[data-game-menu] :text-is("Game settings")'], wait: "[data-game-settings]", lens: "a game's settings, a Game admin" },
      // Running a game (Backstage)
      { id: "run-home-alex", home: "run", who: "alex", go: `/show/${S}/backstage`, ready: "main, h1, h2", lens: "Backstage's home" },
      { id: "run-results-alex", home: "run", who: "alex", go: `/show/${S}/backstage/results`, ready: "main, h1, h2", lens: "Backstage › Results" },
      { id: "run-waivers-alex", home: "run", who: "alex", go: `/show/${S}/backstage/waivers`, ready: "main, h1, h2", lens: "Backstage › Waivers" },
      { id: "run-rules-alex", home: "run", who: "alex", go: `/show/${S}/backstage/rules`, ready: "main, h1, h2", lens: "Backstage › Scoring rules" },
      { id: "run-members-alex", home: "run", who: "alex", go: `/show/${S}/backstage/members`, ready: "main, h1, h2", lens: "Backstage › Members & roles" },
      { id: "run-settings-alex", home: "run", who: "alex", go: `/show/${S}/backstage/settings`, ready: "[data-settings-list], h1, h2", lens: "Backstage › Game settings (the list)" },
      { id: "run-history-jordan", home: "run", who: "jordan", go: `/show/${S}/backstage/history`, ready: "body", lens: "Recent changes, read by a player" },
      // The desk
      { id: "desk-settings", home: "desk", who: DESK, go: "/desk/settings", ready: "main, h1, h2", lens: "the desk's Settings tab" },
      { id: "desk-setup", home: "desk", who: DESK, go: `/desk/season/${S}/setup`, ready: "main, h1, h2", lens: "a season's Setup on the desk" },
      ...round1(pool, fx, S, T, menu, sheet),
    ]);
    failed += r.failed;
    index.push(...r.shot);
  } finally {
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
    if (!has("keep")) {
      await fixture.down(pool).catch((e) => console.log(`(down: ${e.message})`));
      await solo.down(pool).catch((e) => console.log(`(solo down: ${e.message})`));
    }
    await pool.end();
  }
  console.log(failed ? `${failed} FAILED` : "ALL CAPTURED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
