// Dev-only test bank: reopening the installed app where you left off (src/lib/last-page.ts). Needs npm run dev.
//
//   node scripts/dev-test/check-last-page.js [width] [--keep]
//
// Brings linked-fixture.js up (zt_tester in three linked leagues) and simulates launches of the installed app:
// each launch is a fresh tab (new sessionStorage, same localStorage) with navigator.standalone set, the fallback
// iOS reads. Checks that a page you visit is remembered; that a launch on "/" reopens it, in the league it was in
// (ahead of the group's favorite); and that nothing is restored on a reload, after RESTORE_WINDOW, in a browser
// tab, when the launch opened at a particular link (a path, or a notification's ?league=), for the reveal, for
// another account's page, or for a league you've since left. Prints PASS/FAIL per case, exits non-zero on a FAIL,
// and prints page errors. Takes the fixture down at the end unless --keep. Nothing here touches a real league.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");

const HOUR = 60 * 60 * 1000;

(async () => {
  const [w = "390", ...flags] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let failed = false;
  const check = (name, ok, detail = "") => {
    if (!ok) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  };
  try {
    const [classic, roster] = await fixture.up(pool);
    const { rows: [{ id: userId }] } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [fixture.USERNAME]);
    const { page: first, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width: parseInt(w, 10) });
    const context = first.context();
    await first.close();

    // One launch: a new tab, optionally as the installed app, optionally with a remembered page planted first.
    async function launch(path, { standalone = true, seed } = {}) {
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
      if (standalone) await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
      if (seed) await page.addInitScript((s) => { if (!sessionStorage.getItem("rfl.launched")) localStorage.setItem("rfl.lastPage", JSON.stringify(s)); }, seed);
      await page.goto(BASE + path);
      await settle(page);
      return page;
    }
    async function settle(page) {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
    }
    const where = (page) => { const u = new URL(page.url()); return u.pathname + u.search; };
    const openLeague = (page) => page.evaluate((k) => localStorage.getItem(k), `rfl.lastLeague:${userId}`);
    const remembered = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("rfl.lastPage") || "null"));
    const seed = (path, leagueId, ago = 0, user = userId) => ({ userId: user, leagueId, path, at: Date.now() - ago });

    // Remembered as you go, and reopened on the next launch.
    let page = await launch("/");
    await page.goto(BASE + "/scoreboard");
    await settle(page);
    const saved = await remembered(page);
    check("visiting a page remembers it", saved && saved.path === "/scoreboard" && saved.userId === userId, JSON.stringify(saved));
    const league = await openLeague(page);
    await page.close();
    page = await launch("/");
    check("a launch on / reopens the last page", where(page) === "/scoreboard", where(page));
    check("...in the same league", (await openLeague(page)) === league);

    // A reload of "/" in a launched tab stays put.
    await page.goto(BASE + "/");
    await settle(page);
    check("a reload doesn't restore", where(page) === "/", where(page));
    await page.close();

    // The league comes back with the page, even a league other than the group's favorite.
    for (const l of [roster, classic]) {
      page = await launch("/", { seed: seed("/episodes/3", l.leagueId) });
      check(`reopens /episodes/3 in ${l.slug}`, where(page) === "/episodes/3" && (await openLeague(page)) === l.leagueId, `${where(page)} ${await openLeague(page)}`);
      await page.close();
    }
    page = await launch("/", { seed: seed("/waivers/claim?for=k3", roster.leagueId) });
    check("keeps a page's query", where(page) === "/waivers/claim?for=k3", where(page));
    await page.close();

    const stays = [
      ["too long ago", "/", { seed: seed("/episodes/3", roster.leagueId, 7 * HOUR) }, "/"],
      ["a browser tab", "/", { standalone: false, seed: seed("/episodes/3", roster.leagueId) }, "/"],
      ["opened at a page", "/episodes/2", { seed: seed("/episodes/3", roster.leagueId) }, "/episodes/2"],
      ["opened from a notification", `/?league=${classic.leagueId}`, { seed: seed("/episodes/3", roster.leagueId) }, `/?league=${classic.leagueId}`],
      ["the reveal", "/", { seed: seed("/reveal/6", roster.leagueId) }, "/"],
      ["another account's page", "/", { seed: seed("/episodes/3", roster.leagueId, 0, "zt-someone-else") }, "/"],
      ["a league you've left", "/", { seed: seed("/episodes/3", "zt-gone") }, "/"],
    ];
    for (const [name, path, opts, want] of stays) {
      page = await launch(path, opts);
      check(`no restore: ${name}`, where(page) === want, where(page));
      await page.close();
    }
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
