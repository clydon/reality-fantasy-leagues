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
    const b = await open({ user: userOf(x.who), pass: fixture.PASSWORD, width: W, height: H, motion: "reduce" });
    try {
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
      await frame(b.page, x);
      shot.push({ id: x.id, who: x.who, go: x.go, home: x.home, lens: x.lens });
      if (b.errors.length) console.log(`ERRORS ${x.id}: ${b.errors.slice(0, 3).join(" | ")}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${x.id}: ${e.message.split("\n")[0]}`);
      await b.page.screenshot({ path: path.join(OUT, `${x.id}.fail.jpg`), type: "jpeg" }).catch(() => {});
    } finally {
      await b.close();
    }
  }
  return { failed, shot };
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
