// Screenshots pages of a real league as one of its players sees them, on a LOCAL copy of the data
// (e.g. after pulling production down). Lends the seat to a throwaway zt_ account for the run only:
// the seat's membership is pointed at the zt_ user, the pages are captured, and the membership is put
// back in a `finally`, so the real account is never signed in as or changed. Never run against a real
// database. Needs a zt_ admin (db/seed-dev-admin.js with SEED_ADMIN_USERNAME=zt_tester ...) + npm run dev.
//
//   node scripts/dev-test/view-as.js <leagueId> <playerName> <outDir> [width] [--dark] [--path=/episodes/4]...
//
// Writes <outDir>/<player>-<path>-<width>[-dark].png (full page). Defaults to /episodes/4. The zt_
// user gets show_results_immediately, so nothing waits behind the reveal, and What's New marked read,
// so its sheet doesn't cover the page. Prints any page errors.
// --spoilers: keep spoiler protection on (the seat's own "seen through" mark), as most players see it.
// --watch=<seconds>: stay on each page that long from the moment it starts loading, printing every
// navigation and /api request, then a count -- a page stuck reloading in a loop shows up as a stream.
// --linked: also lend the same account's seats in the league's linked leagues (leagues.group_id), so the
// swipe between them -- and its hidden neighbour pages -- is there as that player has it.
// --tap=<css selector>: tap it once the page has loaded (e.g. --tap='[data-tour=tab-more]' opens the
// phone's More sheet), then capture the screen as it is, not grown to the page (a sheet is fixed).
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");

const ZT_USER = process.env.ZT_USER || "zt_tester";
const ZT_PASS = process.env.ZT_PASS || "zt-pass-12345";

(async () => {
  const [leagueId, playerName, out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: view-as.js <leagueId> <playerName> <outDir> [width] [--dark] [--path=…]");
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const spoilers = flags.includes("--spoilers");
  const linked = flags.includes("--linked");
  const watch = Number((flags.find((f) => f.startsWith("--watch=")) || "=0").split("=")[1]) || 0;
  const paths = flags.filter((f) => f.startsWith("--path=")).map((f) => f.slice(7));
  const tap = (flags.find((f) => f.startsWith("--tap=")) || "").slice(6) || null;
  if (!paths.length) paths.push("/episodes/4");

  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const { rows: zt } = await pool.query(`SELECT id FROM "user" WHERE username=$1`, [ZT_USER]);
  if (!zt.length) throw new Error(`no ${ZT_USER}: seed it with db/seed-dev-admin.js`);
  const ztId = zt[0].id;
  const { rows: lr } = await pool.query(`SELECT state FROM leagues WHERE id=$1`, [leagueId]);
  if (!lr.length) throw new Error("no league " + leagueId);
  const player = lr[0].state.players.find((p) => p.name === playerName);
  if (!player) throw new Error(`no player "${playerName}" in ${lr[0].state.players.map((p) => p.name).join(", ")}`);
  const { rows: mem } = await pool.query(`SELECT id, user_id FROM league_memberships WHERE league_id=$1 AND player_id=$2`, [leagueId, player.id]);
  const { rows: clash } = await pool.query(`SELECT id FROM league_memberships WHERE league_id=$1 AND user_id=$2`, [leagueId, ztId]);
  if (clash.length) throw new Error(`${ZT_USER} already holds a seat in this league: a previous run didn't clean up`);

  // What's New marked read, so its sheet doesn't open over every capture.
  const { LATEST_RELEASE_ID } = require("jiti")(__filename)("../../src/lib/whats-new.ts");
  await pool.query(
    `INSERT INTO user_settings (user_id, show_results_immediately, whats_new_seen) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET show_results_immediately = $2, whats_new_seen = $3`,
    [ztId, !spoilers, LATEST_RELEASE_ID]
  );
  // Lend the seat (or, for a seat nobody holds, add a membership that's removed after).
  if (mem.length) await pool.query(`UPDATE league_memberships SET user_id=$1 WHERE id=$2`, [ztId, mem[0].id]);
  else await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1,$2,$3,'member')`, [leagueId, ztId, player.id]);
  // The same account's other seats in this league's group, lent too (put back in the same `finally`).
  const others = linked && mem.length
    ? (await pool.query(
        `SELECT m.id FROM league_memberships m JOIN leagues l ON l.id=m.league_id
          WHERE m.user_id=$1 AND l.id<>$2 AND l.group_id IS NOT NULL AND l.group_id=(SELECT group_id FROM leagues WHERE id=$2)`,
        [mem[0].user_id, leagueId]
      )).rows.map((r) => r.id)
    : [];
  if (others.length) await pool.query(`UPDATE league_memberships SET user_id=$1 WHERE id=ANY($2)`, [ztId, others]);
  try {
    const { page, errors, BASE, close } = await open({ user: ZT_USER, pass: ZT_PASS, width });
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, dark ? "dark" : "light");
    for (const href of paths) {
      // Watched from before the load: a loop can start as soon as the page (and its neighbours) render.
      let n = 0;
      const t0 = Date.now();
      const tag = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
      const onReq = (r) => { if (r.url().includes("/api/")) { n++; console.log(`  ${tag()} ${r.method()} ${r.url().replace(BASE, "")}`); } };
      const onNav = (f) => { if (f === page.mainFrame()) { n++; console.log(`  ${tag()} navigated ${f.url().replace(BASE, "")}`); } };
      if (watch) { page.on("request", onReq); page.on("framenavigated", onNav); }
      await page.goto(`${BASE}${href}${href.includes("?") ? "&" : "?"}league=${leagueId}`, { waitUntil: watch ? "domcontentloaded" : "networkidle" });
      await page.waitForTimeout(watch ? watch * 1000 : 900);
      if (watch) {
        page.off("request", onReq);
        page.off("framenavigated", onNav);
        console.log(`watch ${href}: ${n} requests/navigations in ${watch}s (from the load)`);
      }
      const name = `${playerName}-${href.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}${dark ? "-dark" : ""}${tap ? "-tap" : ""}`;
      if (tap) {
        await page.click(tap);
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${out}/${name}.png` });
        console.log("wrote", name);
        continue;
      }
      // Grow the viewport to the page instead of a fullPage capture, which smears fixed bars (the tab
      // bar, a closed bottom sheet) into the middle; then put it back for the next page.
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.max(h, 844) });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${name}.png` });
      await page.setViewportSize({ width, height: 844 });
      console.log("wrote", name);
    }
    if (errors.length) console.log("errors:", errors.slice(0, 5));
    await close();
  } finally {
    if (others.length) await pool.query(`UPDATE league_memberships SET user_id=$1 WHERE id=ANY($2)`, [mem[0].user_id, others]);
    if (mem.length) await pool.query(`UPDATE league_memberships SET user_id=$1 WHERE id=$2`, [mem[0].user_id, mem[0].id]);
    else await pool.query(`DELETE FROM league_memberships WHERE league_id=$1 AND user_id=$2`, [leagueId, ztId]);
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
