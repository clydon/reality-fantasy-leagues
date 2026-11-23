// Dev-only test bank: reopening the installed app where you left off, on the new design (src/lib/resume-page.ts,
// src/new/last-page.tsx; classic's own is check-last-page.js). Needs npm run dev.
//
//   node scripts/dev-test/check-resume-page.js [width] [--keep]
//
// Brings linked-fixture.js up (zt_tester, on the new design: the gys_ui cookie) and simulates launches of the installed
// app: each launch is a fresh tab (new sessionStorage, same localStorage) with navigator.standalone set, the fallback iOS
// reads, opening at the start URL "/" (which the server sends on to /home). Checks that a page you visit is remembered,
// that a launch reopens it with its query and without Home painting first, and that nothing is reopened on a reload,
// after the six hours, in a browser tab, or when the launch opened at a particular link (what's remembered for a
// reveal, and signing out, are tests/resume-page.test.js's). Prints
// PASS/FAIL per case, exits non-zero on a FAIL, and prints page errors. Takes the fixture down unless --keep. Nothing
// here touches a real account.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");

const HOUR = 60 * 60 * 1000;
const KEY = "gys.lastPage";

(async () => {
  const [w = "390", ...flags] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let failed = false;
  const check = (name, ok, detail = "") => {
    if (!ok) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  };
  try {
    await fixture.up(pool);
    const { rows: [{ id: userId }] } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [fixture.USERNAME]);
    const { page: first, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width: parseInt(w, 10) });
    const context = first.context();
    await context.addCookies([{ name: "gys_ui", value: "new", url: BASE }]);
    await first.close();

    // One launch: a new tab, optionally as the installed app, optionally with a remembered page planted first. `painted`
    // collects every path that was on screen with the page visible, to catch Home flashing before the reopened page.
    async function launch(path, { standalone = true, seed } = {}) {
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
      if (standalone) await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
      if (seed) await page.addInitScript(([k, s]) => { if (!sessionStorage.getItem("gys.launched")) localStorage.setItem(k, JSON.stringify(s)); }, [KEY, seed]);
      await page.goto(BASE + path);
      await settle(page);
      return page;
    }
    async function settle(page) {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
    }
    const where = (page) => { const u = new URL(page.url()); return u.pathname + u.search; };
    const remembered = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEY);
    const seed = (path, ago = 0) => ({ userId, path, at: Date.now() - ago });

    // Remembered as you go, and reopened on the next launch.
    let page = await launch("/");
    check("a launch with nothing remembered opens Home", where(page) === "/home", where(page));
    await page.goto(BASE + "/settings?zt=1");
    await settle(page);
    const saved = await remembered(page);
    check("visiting a page remembers it", saved && saved.path === "/settings?zt=1" && saved.userId === userId, JSON.stringify(saved));
    await page.close();
    page = await launch("/");
    check("a launch on / reopens the last page, query and all", where(page) === "/settings?zt=1", where(page));

    // A reload of the start URL in a launched tab stays put.
    await page.goto(BASE + "/home");
    await settle(page);
    check("a reload doesn't reopen", where(page) === "/home", where(page));
    check("...and Home is remembered now", (await remembered(page))?.path === "/home");
    await page.close();

    const stays = [
      ["too long ago", "/", { seed: seed("/settings", 6.5 * HOUR) }, "/home"],
      ["a browser tab", "/", { standalone: false, seed: seed("/settings") }, "/home"],
      ["opened at Home with a query (a link)", "/home?from=zt", { seed: seed("/settings") }, "/home?from=zt"],
    ];
    for (const [name, path, opts, want] of stays) {
      page = await launch(path, opts);
      check(`no reopen: ${name}`, where(page) === want, where(page));
      await page.close();
    }

    // No Home painted on the way: the page stays hidden from the boot script to the reopened page.
    page = await context.newPage();
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await page.addInitScript(([k, s]) => { if (!sessionStorage.getItem("gys.launched")) localStorage.setItem(k, JSON.stringify(s)); }, [KEY, seed("/settings")]);
    const homeResponses = [];
    page.on("response", (r) => { if (new URL(r.url()).pathname === "/home" && r.request().isNavigationRequest()) homeResponses.push(r.status()); });
    await page.goto(BASE + "/");
    await settle(page);
    check("reopening goes there before Home renders", where(page) === "/settings", `${where(page)}; /home loads: ${homeResponses.join(",") || "none"}`);
    await page.close();

    if (errors.length) console.log("page errors:\n  " + [...new Set(errors)].join("\n  "));
    await close();
  } finally {
    if (!flags.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
