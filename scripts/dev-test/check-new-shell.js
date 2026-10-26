// Dev-only check for step 0c, the new design's shell (docs/PLAN-new-design.md), in a real browser against the dev
// server, as new-fixture.js's alex:
//   - opting in: classic's More › "Try the new design" lands on /home (on a desktop width: the setting, then "/");
//     "/" goes to /home from then on, by the cookie, and through AuthGate on a device without it;
//   - the hub's show card changes the channel into the show (its art grows into the show bar), the tabs slide
//     sideways with the show bar and tab bar still, Backstage and its pages push in and pop back, How it works
//     is a page pushed over the show that the back gesture closes, a Preview tap says "Coming soon", the guard
//     chip says where you are, first run steps forward;
//   - every navigation is a view transition of the right kind (html[data-nav], and the CSS animations that ran);
//   - "Back to the classic design" lands on classic's "/" and stays there.
// Screenshots of each screen go to <outDir>.
//
//   npm run dev                                                   (in another terminal)
//   node scripts/dev-test/check-new-shell.js <outDir> [--width=390] [--reduce] [--keep]
//
// --width=1280 checks the desktop column; --reduce runs with reduced motion (every move a calm crossfade);
// --keep leaves the fixture up afterwards (sign in as zt_nd_alex / zt-pass-12345 to look around). Brings
// new-fixture.js up and takes it down; touches zt-nd rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-shell runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-shell.js <outDir> [--width=390] [--reduce] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const reduce = args.includes("--reduce");
const desktop = width >= 760;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// Every view transition React starts: html[data-nav] at that moment, and the animations that ran.
function recordTransitions() {
  window.__vt = [];
  const start = Document.prototype.startViewTransition;
  if (!start) return;
  Document.prototype.startViewTransition = function (arg) {
    const entry = { nav: document.documentElement.dataset.nav || null, anims: [] };
    window.__vt.push(entry);
    const t = start.call(this, arg);
    t.ready
      .then(() => {
        entry.anims = document.documentElement
          .getAnimations({ subtree: true })
          .filter((a) => a.effect && a.effect.pseudoElement && a.effect.pseudoElement.startsWith("::view-transition"))
          .map((a) => `${a.effect.pseudoElement} ${a.animationName || ""}`.trim());
      })
      .catch((e) => (entry.err = String(e)));
    return t;
  };
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    // Real-looking art on the zt show (a file the site serves), so the channel change has a picture to grow.
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);

    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844, motion: reduce ? "reduce" : "on" });
    close = b.close;
    const { page, BASE, errors } = b;
    await page.context().addInitScript(recordTransitions);
    // Next's dev badge sits over the first tab.
    await page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    let shot = 0;
    const snap = async (name) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, `${String(++shot).padStart(2, "0")}-${name}.png`) });
    };
    const lastVt = () => page.evaluate(() => window.__vt.at(-1) || null);
    // The keyframes the whole screen (the root snapshot) comes in with, by kind (new.css); desktop's push and pop
    // are the short nudge.
    const SCREEN_IN = {
      push: desktop ? "nd-nudge-in-r" : "nd-from-right",
      pop: desktop ? "nd-nudge-in-l" : "nd-from-left",
      left: "nd-nudge-in-r",
      right: "nd-nudge-in-l",
      channel: "nd-fade-in",
      fade: "nd-fade-in",
      calm: "nd-fade-in",
    };
    // A navigation's transition: its kind, the screen moving in that way, and any other animation in `also` (a
    // keyframes name or a named group).
    async function moved(what, kind, ...also) {
      await page.waitForTimeout(600);
      const vt = await lastVt();
      const want = reduce ? "calm" : kind;
      check(vt && vt.nav === want, `${what}: a "${want}" transition`, JSON.stringify(vt && { nav: vt.nav, err: vt.err }));
      const ran = (a) => !!vt && vt.anims.some((x) => x.includes(a));
      const screen = `::view-transition-new(root) ${SCREEN_IN[want]}`;
      check(ran(screen), `${what}: the screen moves (${SCREEN_IN[want]})`, vt ? vt.anims.join(", ") : "none");
      if (!reduce) for (const a of also) check(ran(a), `${what}: ${a} ran`, vt ? vt.anims.join(", ") : "none");
      await page.evaluate(() => (window.__vt.length = 0));
    }
    const cookie = async () => (await page.context().cookies()).find((c) => c.name === "gys_ui")?.value ?? null;

    // ---- opting in ----
    if (!desktop) {
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await page.locator("[data-tour=tab-more]").click();
      await page.getByText("Try the new design").click();
      await page.waitForURL("**/home", { timeout: 30_000 });
    } else {
      const r = await page.request.put(BASE + "/api/me/settings", { data: { ui: "new" }, headers: { origin: BASE } });
      check(r.ok(), "opting in through the settings API");
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
    }
    check(new URL(page.url()).pathname === "/home", "opting in lands on /home", page.url());
    check((await cookie()) === "new", "this device remembers the choice (gys_ui cookie)");
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    check(new URL(page.url()).pathname === "/home", `"/" goes to /home`, page.url());
    // Another device: no cookie yet. AuthGate asks /api/me, goes on to /home and the cookie comes back.
    await page.context().clearCookies({ name: "gys_ui" });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForURL("**/home", { timeout: 30_000 });
    check(new URL(page.url()).pathname === "/home" && (await cookie()) === "new", "a device without the cookie gets there too, and gets the cookie");

    // ---- the hub ----
    // The show's card on Your shows: the link holding its art (Up next and the status line link there too, and since step 11
    // the guide's card for its next episode).
    const card = page.locator(`[data-poster="${sid}"] a[href="/show/${sid}/tonight"]:has([data-art])`);
    await card.first().waitFor({ timeout: 30_000 });
    check((await card.count()) === 1, "the hub lists the couch's show once, as a card");
    await page.getByRole("button", { name: "Your profile" }).click();
    check(await page.getByRole("dialog").getByText("ZT Survivor 51").first().isVisible(), "your profile names your couch");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.evaluate(() => (window.__vt.length = 0));
    await snap("home");
    await page.locator('[data-preview="hub.watch-along"]').first().click();
    check(await page.getByText("Coming soon: Watch along").isVisible(), "a Preview tap says Coming soon");

    // ---- into the show: the channel change ----
    await card.click();
    await page.waitForURL(`**/show/${sid}/tonight`);
    await moved("hub → show", "channel", "(nd-art)");
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    // "in 3 days" by the database's date (the fixture's), "in 4" by the browser's once it's past midnight UTC.
    check(await page.getByText(/^Ep 6 · in \d days$/).first().isVisible(), "the show bar's calm clock: Ep 6 · in N days");
    const tabs = (await page.locator("nav[aria-label=Show] a").allTextContents()).map((t) => t.replace(/\d+$/, ""));
    check(tabs.join(",") === "Tonight,Episodes,Games,Cast,Chat", "five tabs on a couch's show", tabs.join(","));
    // The moves due in this show's games, as the home counts them (how many depends on the day the fixture runs, and
    // the league clocks can add one after the hub first read it): a reload reads it fresh, then the API agrees.
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("nav[aria-label=Show]").waitFor();
    // Only this couch's games: alex also plays this show on a second couch (the fixture's "ZT Extra").
    const home = await (await page.request.get(BASE + "/api/me/home")).json();
    const space = await (await page.request.get(`${BASE}/api/seasons/${sid}/space?couch=${fx.couchId}`)).json();
    const here = new Set(space.games.filter((g) => g.yourRole).map((g) => g.leagueId));
    const due = home.moves.filter((m) => here.has(m.leagueId)).length;
    const badge = (await page.locator("nav[aria-label=Show] a", { hasText: "Tonight" }).innerText()).replace(/\s+/g, "");
    check(due > 0 && badge === `Tonight${due}`, `Tonight's badge counts alex's ${due} moves due in this couch's games`, JSON.stringify(badge));
    await snap("tonight");

    // ---- tabs slide sideways ----
    await page.locator("nav[aria-label=Show] a", { hasText: "Episodes" }).click();
    await page.waitForURL(`**/show/${sid}/episodes`);
    await moved("Tonight → Episodes", "left", "nd-tabind");
    check(await page.getByText("you're on Ep 5").isVisible(), "the guard chip says where you are (Ep 5)");
    await snap("episodes");
    await page.locator("nav[aria-label=Show] a", { hasText: "Cast" }).click();
    await page.waitForURL(`**/show/${sid}/cast`);
    await moved("Episodes → Cast", "left");
    await page.locator("nav[aria-label=Show] a", { hasText: "Tonight" }).click();
    await page.waitForURL(`**/show/${sid}/tonight`);
    await moved("Cast → Tonight", "right", "nd-showbar");

    // ---- the menu, Backstage and its pages ----
    await page.getByRole("button", { name: "Show menu" }).click();
    await page.getByRole("dialog").getByText("Backstage").waitFor();
    await snap("show-menu");
    await page.getByRole("dialog").getByText("Backstage").click();
    await page.waitForURL(`**/show/${sid}/backstage`);
    await moved("show → Backstage", "push");
    check(await page.getByText("You run this").isVisible(), "Backstage knows alex runs these games");
    await snap("backstage");
    await page.getByRole("link", { name: /Results/ }).click();
    await page.waitForURL(`**/show/${sid}/backstage/results`);
    await moved("Backstage → Results", "push");
    await snap("backstage-results");
    const before = await page.evaluate(() => history.length);
    await page.getByRole("button", { name: "Backstage" }).click();
    await page.waitForURL(`**/show/${sid}/backstage`);
    await moved("Results → Backstage (back)", "pop", desktop ? "nd-nudge-out-r" : "nd-to-right");
    check((await page.evaluate(() => history.length)) === before, "back is the browser's back (no new history entry)");
    await page.getByRole("button", { name: "ZT Survivor" }).click();
    await page.waitForURL(`**/show/${sid}/tonight`);
    await moved("Backstage → show (back)", "pop");

    // ---- How it works: pushed over the show, closed by the back gesture ----
    await page.getByRole("button", { name: "Show menu" }).click();
    await page.getByRole("dialog").getByText("How it works").click();
    await page.waitForURL(/\?page=how-it-works/);
    await page.waitForTimeout(600);
    check(await page.locator('[data-how]').isVisible(), "How it works opens over the show");
    const covered = await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight - 20)?.closest("[role=dialog]"));
    check(covered, "it covers the whole screen, the tab bar too");
    await snap("how-it-works");
    await page.goBack();
    await page.waitForTimeout(600);
    check(!page.url().includes("page=") && !(await page.locator('[data-how]').isVisible()), "the back gesture closes it, on the same show");

    // ---- back to the hub: the channel change in reverse ----
    await page.getByRole("button", { name: "Home" }).click();
    await page.waitForURL("**/home");
    await moved("show → hub", "channel", "(nd-art)");

    // ---- you ----
    await page.getByRole("button", { name: "Your profile" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Settings" }).click();
    await page.waitForURL("**/settings");
    await moved("hub → Settings", "push");
    await snap("settings");
    await page.goto(BASE + "/start/1", { waitUntil: "networkidle" });
    // First run (step 9 part 2) wants a show picked before Next.
    await page.locator("[data-show-wall] [data-pick]").first().click();
    await page.locator("[data-next]").click();
    await page.waitForURL("**/start/2");
    await moved("first run 1 → 2", "push");
    await snap("start-2");
    await page.goto(BASE + "/settings", { waitUntil: "networkidle" });

    // ---- back to classic ----
    await page.getByText("Back to the classic design").click();
    await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 30_000 });
    await page.waitForTimeout(1500);
    check(new URL(page.url()).pathname === "/" && (await cookie()) === null, "Back to the classic design lands on classic's / and forgets the cookie");
    check(await page.locator("main").first().isVisible(), "classic's shell is back");
    await snap("classic");

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
