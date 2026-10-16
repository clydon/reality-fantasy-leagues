// Screenshots pages of a real league as one of its players sees them, on a LOCAL copy of the data
// (e.g. after pulling production down). Lends the seat to a throwaway zt_ account for the run only:
// the seat's membership is pointed at the zt_ user, the pages are captured, and the membership is put
// back in a `finally`, so the real account is never signed in as or changed. Never run against a real
// database. Needs a zt_ admin (db/seed-dev-admin.js with SEED_ADMIN_USERNAME=zt_tester ...) + npm run dev.
//
//   node scripts/dev-test/view-as.js <leagueId> <playerName> <outDir> [width] [--dark] [--path=/episodes/4]...
//
// Writes <outDir>/<player>-<path>-<width>[-dark].png (full page). Defaults to /episodes/4. The zt_
// user gets show_results_immediately, so nothing waits behind the reveal. Prints any page errors.
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
  const paths = flags.filter((f) => f.startsWith("--path=")).map((f) => f.slice(7));
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

  await pool.query(
    `INSERT INTO user_settings (user_id, show_results_immediately) VALUES ($1, true)
     ON CONFLICT (user_id) DO UPDATE SET show_results_immediately = true`,
    [ztId]
  );
  // Lend the seat (or, for a seat nobody holds, add a membership that's removed after).
  if (mem.length) await pool.query(`UPDATE league_memberships SET user_id=$1 WHERE id=$2`, [ztId, mem[0].id]);
  else await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1,$2,$3,'member')`, [leagueId, ztId, player.id]);
  try {
    const { page, errors, BASE, close } = await open({ user: ZT_USER, pass: ZT_PASS, width });
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, dark ? "dark" : "light");
    for (const href of paths) {
      await page.goto(`${BASE}${href}${href.includes("?") ? "&" : "?"}league=${leagueId}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      const name = `${playerName}-${href.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}${dark ? "-dark" : ""}`;
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
    if (mem.length) await pool.query(`UPDATE league_memberships SET user_id=$1 WHERE id=$2`, [mem[0].user_id, mem[0].id]);
    else await pool.query(`DELETE FROM league_memberships WHERE league_id=$1 AND user_id=$2`, [leagueId, ztId]);
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
