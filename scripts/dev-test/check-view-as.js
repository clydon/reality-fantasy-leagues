// Dev-only check for a site admin's View as (src/lib/server/view-as.ts, /api/me/view-as; the desk header's eye), against the dev
// server, on new-fixture.js's couch ("ZT Survivor 51": alex runs its three linked games) with alex made a site admin for the run
// (put back after). In a real browser at --width (390 by default), as alex:
//   1. The desk's eye opens View as (Player, Commissioner); riley (no site admin) is refused starting it.
//   2. Player: home; no site admin (/api/me, the desk refused and its page says so); every game of his a member's (/api/me/home),
//      a commissioner's read refused (shared rulesets); the profile menu has no Admin row, only "Viewing as a player: back to you".
//   3. Back to you: the desk again, a site admin.
//   4. Commissioner: no site admin, but his games at his own role (a Commissioner's read answered); back.
// Nothing wider than the screen. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-view-as.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it, alex a site admin); touches zt rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-view-as runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-view-as.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  let A = null;
  try {
    const fx = await fixture.up(pool);
    A = fx.users.alex;
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [A]);
    const ours = [fx.leagues.outlast, fx.leagues.lineup, fx.leagues.pool];

    const riley = await api({ user: fixture.username("riley"), pass: fixture.PASSWORD });
    check((await riley.call("POST", "/api/me/view-as", { as: "player" })).status === 403, "riley (no site admin): refused View as");

    const B = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width });
    closers.push(B.close);
    const page = B.page;
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const get = async (url) => {
      const r = await page.request.get(BASE + url);
      return { status: r.status(), body: await r.json().catch(() => null) };
    };
    const noWider = async (where) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      check(w <= width, `${where}: nothing wider than the screen`, `${w}px`);
    };
    /** alex's roles in his three games on the couch, from the home. */
    const roles = async () => {
      const home = (await get("/api/me/home")).body;
      const games = (home?.couches ?? []).flatMap((c) => c.games ?? []).filter((g) => ours.includes(g.leagueId));
      return games.map((g) => g.yourRole);
    };
    const profile = async () => {
      await page.goto(BASE + "/home");
      await page.getByRole("button", { name: "Your profile" }).click();
    };
    const start = async (as) => {
      await page.goto(BASE + "/desk");
      await page.locator("[data-view-as]").click();
      await page.locator(`[data-view-as-pick="${as}"]`).waitFor({ timeout: 15000 });
      if (as === "player") await page.screenshot({ path: path.join(out, "view-as-sheet.png") });
      await Promise.all([page.waitForURL(/\/home$/, { timeout: 30000 }), page.locator(`[data-view-as-pick="${as}"]`).click()]);
    };
    const back = async (as) => {
      await profile();
      await page.locator(`[data-view-as-back="${as}"]`).waitFor({ timeout: 15000 });
      await Promise.all([page.waitForURL(/\/desk$/, { timeout: 30000 }), page.locator(`[data-view-as-back="${as}"]`).click()]);
      await page.locator("[data-desk-tab]").first().waitFor({ timeout: 20000 });
      check((await get("/api/me")).body?.user?.isSuperAdmin === true && (await get("/api/desk/inbox")).status === 200, `back from ${as}: a site admin, the desk open`);
    };

    // ---------- 1. the eye ----------
    check((await roles()).every((r) => r === "commissioner") && (await roles()).length === 3, "as himself: alex runs his three games", JSON.stringify(await roles()));
    await page.goto(BASE + "/desk");
    await page.locator("[data-view-as]").waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(out, "desk-eye.png") });
    await noWider("the desk with its eye");

    // ---------- 2. player ----------
    await start("player");
    check((await get("/api/me")).body?.user?.isSuperAdmin === false, "player: no site admin (/api/me)");
    check((await get("/api/desk/inbox")).status === 403, "player: the desk's reads refused");
    const pr = await roles();
    check(pr.length === 3 && pr.every((r) => r === "member"), "player: a member in each of his games", JSON.stringify(pr));
    check((await get(`/api/leagues/${fx.leagues.lineup}/ruleset/shared`)).status === 403, "player: a commissioner's read refused (shared rulesets)");
    await profile();
    await page.locator('[data-view-as-back="player"]').waitFor({ timeout: 15000 });
    check((await page.locator("[data-admin-row]").count()) === 0, "player: the profile menu has no Admin row");
    check(/Viewing as a player/.test(await page.locator('[data-view-as-back="player"]').innerText()), "player: its Admin row says so and goes back");
    await page.screenshot({ path: path.join(out, "player-profile.png") });
    await noWider("the profile menu as a player");
    await page.goto(BASE + "/desk");
    await page.getByText("The desk is for site admins").waitFor({ timeout: 15000 });
    check(true, "player: the desk's page says it's for site admins");

    // ---------- 3. back ----------
    await back("player");

    // ---------- 4. commissioner ----------
    await start("commissioner");
    check((await get("/api/me")).body?.user?.isSuperAdmin === false && (await get("/api/desk/inbox")).status === 403, "commissioner: no site admin, the desk refused");
    const cr = await roles();
    check(cr.length === 3 && cr.every((r) => r === "commissioner"), "commissioner: his own role in each game", JSON.stringify(cr));
    const shared = await get(`/api/leagues/${fx.leagues.lineup}/ruleset/shared`);
    // Not refused (a 403); it answers 500 for any commissioner on the local DB today (BACKLOG), lens or not.
    check(shared.status !== 403, "commissioner: a commissioner's read not refused (shared rulesets)", `${shared.status} ${JSON.stringify(shared.body)}`);
    await profile();
    await page.locator('[data-view-as-back="commissioner"]').waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(out, "commissioner-profile.png") });
    await back("commissioner");

    check(!errors.length, "no page errors", errors.join(" | "));
  } catch (e) {
    console.log("FAIL  " + (e.stack || e.message));
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) {
      if (A) await pool.query(`UPDATE "user" SET role = 'user' WHERE id = $1`, [A]).catch(() => {});
      await fixture.down(pool).catch((e) => console.log("down failed: " + e.message));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
