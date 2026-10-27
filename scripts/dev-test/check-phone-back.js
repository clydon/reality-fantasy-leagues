// Dev-only check for the phone's back in the installed app (src/components/phone-back.tsx), in a real browser against
// the dev server, as new-fixture.js's alex. Each launch is a fresh tab with navigator.standalone set (the fallback iOS
// reads, as check-last-page.js does) on a touch screen:
//   - a browser tab keeps the browser's own back: nothing is put under its first page;
//   - opened deep (Backstage › Results), back goes up a page at a time (Backstage, the show, the hub), then says
//     "Press back again to exit" with nothing behind it (the next back closes the app), and says it again once that's
//     gone; both before any tap and after one;
//   - the trail you took comes first; a page pushed over the screen (?page=) closes to the screen under it; after a
//     reload, back still goes up;
//   - classic: a relaunch where you left off (lib/last-page.ts) backs up Episode 3 › Episodes › Overview, then the hint;
//   - no back reloads the page (Next's router never sees the entry put under the first page).
//
// Android's back is stood in for two ways. Before a tap, by Escape: on desktop that's the close request a close watcher
// takes, as Android's back is. After a tap, by the history's own back (CDP's), which skips nothing, as Chrome's back
// skips nothing once the page has had a tap. Neither is the real button, so check on a phone too.
//
//   npm run dev                                    (in another terminal)
//   node scripts/dev-test/check-phone-back.js [--width=390] [--shots=<dir>] [--keep]
//
// --shots saves a screenshot of each hint to <dir>. --keep leaves the fixture up afterwards (sign in as zt_nd_alex / zt-pass-12345). Brings new-fixture.js up and takes it
// down; touches zt-nd rows only; refuses a non-local database. Prints PASS/FAIL per case, exits non-zero on a FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path_ = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-phone-back runs against a local database only");

const args = process.argv.slice(2);
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const shots = (args.find((a) => a.startsWith("--shots=")) || "").slice(8) || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const HINT = "Press back again to exit";
const QUIET_MS = 4000; // src/new/ui/toast.tsx: how long the hint is up

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// Reads the page through the tab's own CDP session: Playwright's page.evaluate and waits run as a user gesture, which
// would count as a tap. `page.cdp` is set by launch().
async function run(page, fn, arg) {
  const r = await page.cdp.send("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function until(page, fn, arg, timeout = 20000) {
  for (const end = Date.now() + timeout; Date.now() < end; await page.waitForTimeout(100)) {
    if (await run(page, fn, arg).catch(() => false)) return true;
  }
  return false;
}

// Where the tab is: the page, whether it's on the entry put under the first page, its place among the app's entries
// (the tab's about:blank sits before them), and whether the page has reloaded since launch (the mark is gone) or had a tap.
const where = (page) =>
  run(page, () => ({
    path: location.pathname + location.search,
    floor: !!(history.state && history.state.gysFloor),
    index: navigation.currentEntry.index,
    entries: navigation.entries().length,
    mark: window.__mark === 1,
    tapped: navigator.userActivation.hasBeenActive,
  }));
const show = (w) => JSON.stringify(w);

const waitPath = (page, path) => until(page, (p) => location.pathname + location.search === p, path);

// The hint on screen: its words, in an element that isn't hidden (the new design's toast stays in the page, invisible).
const hinted = (page) =>
  until(
    page,
    (hint) => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (n.textContent.includes(hint) && n.parentElement.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return true;
      }
      return false;
    },
    HINT,
    5000
  );

// A tap on something that does nothing (a heading or a line of text), so the page has had a tap.
async function tap(page) {
  const pt = await page.evaluate(() => {
    for (const el of document.querySelectorAll("h1, h2, h3, p")) {
      if (el.closest("a, button, [role=button], label, input, summary, [role=dialog]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 20 && r.height > 8 && r.top > 0 && r.bottom < innerHeight) return { x: r.left + 4, y: r.top + r.height / 2 };
    }
    return null;
  });
  if (!pt) throw new Error("nothing to tap on " + page.url());
  await page.touchscreen.tap(pt.x, pt.y);
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  let close = async () => {};
  try {
    const f = await fixture.up(pool);
    const S = `/show/${f.seasonId}`;
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width });
    close = b.close;
    const { BASE, errors } = b;
    const context = b.page.context();
    await b.page.close();

    // A launch: a new tab, as the installed app unless `standalone` is false; `before` runs ahead of the page's scripts.
    async function launch(path, { standalone = true, before } = {}) {
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url().replace(BASE, "")}`));
      if (standalone) await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
      if (before) await page.addInitScript(before.fn, before.arg);
      page.cdp = await context.newCDPSession(page);
      await page.goto(BASE + path);
      await page.waitForLoadState("networkidle").catch(() => {});
      await run(page, () => (window.__mark = 1));
      return page;
    }

    // Back at the top: the hint, on the first entry (the next back closes the app), no reload; once the hint has gone,
    // the page is back above it, so a back says it again.
    async function atTheTop(page, path, label, again) {
      check(await hinted(page), `${label}: at the top, back says "${HINT}"`);
      if (shots) await page.screenshot({ path: path_.join(shots, `hint-${label.replace(/\W+/g, "-")}.png`) });
      let w = await where(page);
      check(w.path === path && w.floor && w.index === 0 && w.mark, `${label}: nothing behind it, so the next back closes the app`, show(w));
      await page.waitForTimeout(QUIET_MS + 700);
      w = await where(page);
      check(w.path === path && !w.floor && w.index === 1 && w.mark, `${label}: once the hint has gone, back would say it again`, show(w));
      await again();
      check(await hinted(page), `${label}: and does`);
      w = await where(page);
      check(w.floor && w.index === 0 && w.mark, `${label}: on the first entry again`, show(w));
    }

    // 1. A browser tab.
    {
      const page = await launch("/settings", { standalone: false });
      const w = await where(page);
      check(w.entries === 1 && w.index === 0 && !w.floor, "a browser tab: nothing put under its first page", show(w));
      await page.close();
    }

    // 2. Opened deep, back before any tap (the close watcher).
    {
      const page = await launch(`${S}/backstage/results`);
      let w = await where(page);
      check(w.index === 1 && w.entries === 2 && !w.tapped, "opened deep: an entry put under the first page", show(w));
      const esc = () => page.keyboard.press("Escape");
      for (const [to, label] of [
        [`${S}/backstage`, "Results › Backstage"],
        [`${S}/tonight`, "Backstage › the show"],
        ["/home", "the show › the hub"],
      ]) {
        await esc();
        const ok = await waitPath(page, to);
        w = await where(page);
        check(ok && w.mark && w.index === 1, `no tap: back goes up, ${label}`, show(w));
      }
      await esc();
      await atTheTop(page, "/home", "no tap", esc);
      await page.close();
    }

    // 3. Opened deep, back after a tap (the history's own back).
    {
      const page = await launch(`${S}/backstage/results`);
      await tap(page);
      let w = await where(page);
      check(w.tapped && w.path === `${S}/backstage/results`, "a tap that goes nowhere", show(w));
      for (const [to, label] of [
        [`${S}/backstage`, "Results › Backstage"],
        [`${S}/tonight`, "Backstage › the show"],
        ["/home", "the show › the hub"],
      ]) {
        await page.goBack();
        const ok = await waitPath(page, to);
        w = await where(page);
        check(ok && w.mark && w.index === 1, `after a tap: back goes up, ${label}`, show(w));
      }
      await page.goBack();
      await atTheTop(page, "/home", "after a tap", () => page.goBack());
      // In the app that closes it; here, the tab's about:blank is the page before the app's.
      await page.goBack();
      check(page.url() === "about:blank", "after a tap: a back while the hint is up leaves the app", page.url());
      await page.close();
    }

    // 4. The trail you took comes first.
    {
      const page = await launch("/home");
      await page.locator(`a[href^="${S}"]`).first().click();
      await until(page, (s) => location.pathname.startsWith(s), S);
      await page.goBack();
      const ok = await waitPath(page, "/home");
      const w = await where(page);
      check(ok && !w.floor && w.index === 1 && w.mark, "the trail: back from the show returns to the hub you came from", show(w));
      await page.goBack();
      check(await hinted(page), "the trail: then the hint");
      await page.close();
    }

    // 5. A page pushed over the screen, opened from a link.
    {
      const page = await launch(`${S}/tonight?page=how`);
      await page.keyboard.press("Escape");
      const ok = await waitPath(page, `${S}/tonight`);
      const w = await where(page);
      check(ok && w.mark && w.index === 1, "a pushed page opened from a link: back closes it to the screen under it", show(w));
      await page.close();
    }

    // 6. A reload (pull-to-refresh), then back: the entry under the first page belongs to the page before the reload.
    {
      const page = await launch(`${S}/backstage`);
      await tap(page);
      await page.reload();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.goBack();
      const ok = await waitPath(page, `${S}/tonight`);
      const w = await where(page);
      check(ok && w.index === 1 && !w.floor, "after a reload: back still goes up, Backstage › the show", show(w));
      await page.close();
    }

    // 7. Classic: the installed app reopened where you left off (lib/last-page.ts), then back.
    {
      const seed = { userId: f.users.alex, leagueId: f.leagues.outlast, path: "/episodes/3", at: Date.now() };
      const page = await launch("/", {
        before: { fn: (s) => sessionStorage.getItem("rfl.launched") || localStorage.setItem("rfl.lastPage", JSON.stringify(s)), arg: seed },
      });
      const reopened = await waitPath(page, "/episodes/3");
      let w = await where(page);
      check(reopened && w.index === 1, "classic: reopened on Episode 3, with an entry put under it", show(w));
      const esc = () => page.keyboard.press("Escape");
      for (const [to, label] of [
        ["/episodes", "Episode 3 › Episodes"],
        ["/", "Episodes › Overview"],
      ]) {
        await esc();
        const ok = await waitPath(page, to);
        w = await where(page);
        check(ok && w.mark && w.index === 1, `classic: back goes up, ${label}`, show(w));
      }
      await esc();
      await atTheTop(page, "/", "classic", esc);
      await page.close();
    }

    if (errors.length) console.log(`page errors (${errors.length}):\n  ${[...new Set(errors)].slice(0, 12).join("\n  ")}`);
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close();
    if (!keep) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})();
