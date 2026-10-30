// Dev-only check that classic's admin is retired (docs/PLAN-desk-parity.md step 8; until then it checked that every page
// rendered): every old /admin address sends a site admin to the desk's page for the same thing, against the dev server.
//   1. A site admin of its own (zt_ca_admin, on no couch and in no league) and a player (zt_ca_player) are made.
//   2. As the site admin, at --width: each of classic's 19 pages (the lists, then one of each detail page: a show, its
//      settings, a season, its setup, cast, rules, an episode and its review, a user, a league, a format; the first of each
//      kind the database holds), /reports and an address classic never had. Each passes when it lands on its desk page
//      (a person, a game, a show, a season and the pages under it, Reports, Settings, else the Inbox), with no page error,
//      more than "Loading…" on it, and nothing wider than the screen.
//   3. As the player: /admin and a page under it send them home, never to the desk. Signed out: to sign in, which comes
//      back to the same address.
//   4. Nothing classic's admin called answers any more (/api/admin/*: 404), and the desk's Settings has no Classic admin row.
//   5. Sign out while acting as someone (Noticed af, taken at step 8): Settings' Sign out ends the hour (its end in their
//      History) and signs the admin out too, so no admin session is left waiting in the admin_session cookie.
// Screenshots go to <outDir>. They show whatever the local database holds (a copy of production): keep them out of the
// repo (docs/HOSTING.md, The repo is public).
//
//   npm run dev                                                           (in another terminal)
//   node scripts/dev-test/check-classic-admin.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-classic-admin.js down                     (takes the zt_ca_ accounts out, after --keep)
//
// Reads every page but writes nothing except its own two accounts, keyed on the zt_ca_ username, which `down` removes (and
// the run removes unless --keep). Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");

const DB = process.env.AUTH_DATABASE_URL || "";
const ADMIN = "zt_ca_admin";
const PLAYER = "zt_ca_player";
const PASSWORD = "zt-pass-12345";

const arg = (name, dflt) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1] || dflt;

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  for (const [name, role] of [[ADMIN, "admin"], [PLAYER, "user"]]) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now(), now())`,
      [id, name, `${name}@example.invalid`, role]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), id, await hashPassword(PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
  }
}

async function down(pool) {
  const { rows } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_ca\\_%'`);
  const ids = rows.map((r) => r.id);
  if (!ids.length) return;
  await pool.query(`DELETE FROM admin_changes WHERE user_id = ANY($1::text[])`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM user_last_seen WHERE user_id = ANY($1::text[])`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM user_settings WHERE user_id = ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM session WHERE "userId" = ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM account WHERE "userId" = ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [ids]);
}

// [name, classic's address, the desk's page it should land on]: the lists, then one of each detail page from what the
// database holds (an airing season first, the first other account, league and format).
async function routes(pool) {
  const out = [
    ["to-do", "/admin", "/desk"], ["shows", "/admin/shows", "/desk/shows"], ["new-show", "/admin/shows/new", "/desk/new"],
    ["users", "/admin/users", "/desk/people"], ["leagues", "/admin/leagues", "/desk/games"], ["formats", "/admin/formats", "/desk"],
    ["reports", "/admin/reports", "/desk/reports"], ["site", "/admin/site", "/desk/settings"], ["old-reports", "/reports", "/desk/reports"],
    ["never-classic", "/admin/nothing/here", "/desk"],
  ];
  const { rows: seasons } = await pool.query(
    `SELECT ss.id, ss.show_id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE NOT s.archived ORDER BY (ss.status = 'airing') DESC, s.name, ss.season_number LIMIT 1`
  );
  const season = seasons[0];
  if (season) {
    out.push(["show", `/admin/shows/${season.show_id}`, `/desk/show/${season.show_id}`], ["show-settings", `/admin/shows/${season.show_id}/settings`, `/desk/show/${season.show_id}`]);
    const s = `/admin/seasons/${season.id}`;
    const d = `/desk/season/${season.id}`;
    out.push(["season", s, d], ["season-setup", `${s}/setup`, `${d}/setup`], ["season-cast", `${s}/cast`, `${d}/cast`], ["season-rules", `${s}/rules`, d]);
    out.push(["episode", `${s}/episodes/1`, `${d}/e/1`], ["episode-review", `${s}/episodes/1/review`, `${d}/e/1`]);
  }
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username NOT LIKE 'zt\\_ca\\_%' AND role IS DISTINCT FROM 'admin' ORDER BY "createdAt" LIMIT 1`);
  if (users[0]) out.push(["user", `/admin/users/${users[0].id}`, `/desk/person/${users[0].id}`]);
  const { rows: leagues } = await pool.query(`SELECT id FROM leagues WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`);
  if (leagues[0]) out.push(["league", `/admin/leagues/${leagues[0].id}`, `/desk/game/${leagues[0].id}`]);
  const { rows: formats } = await pool.query(`SELECT id FROM show_formats ORDER BY created_at LIMIT 1`).catch(() => ({ rows: [] }));
  if (formats[0]) out.push(["format", `/admin/formats/${formats[0].id}`, "/desk"]);
  return out;
}

async function main() {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("refusing: AUTH_DATABASE_URL is not a local database");
  const pool = new Pool({ connectionString: DB });
  if (process.argv[2] === "down") {
    await down(pool);
    await pool.end();
    console.log("zt_ca_ accounts removed");
    return;
  }
  const outDir = process.argv[2];
  if (!outDir || outDir.startsWith("--")) throw new Error("usage: check-classic-admin.js <outDir> [--width=390] [--keep]");
  fs.mkdirSync(outDir, { recursive: true });
  const width = Number(arg("width", "390"));
  const keep = process.argv.includes("--keep");
  let fails = 0;
  const check = (ok, line) => {
    if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"} ${line}`);
  };

  try {
    await up(pool);
    const list = await routes(pool);
    check(list.length === 21, `classic's 19 pages, /reports and one it never had (${list.length})`);

    // ---------- a site admin: each lands on its desk page ----------
    const b = await open({ user: ADMIN, pass: PASSWORD, width, height: 844 });
    try {
      for (const [i, [name, url, want]] of list.entries()) {
        b.errors.length = 0;
        await b.page.goto(b.BASE + url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
        await b.page.waitForTimeout(400);
        const at = new URL(b.page.url());
        const seen = await b.page.evaluate(() => {
          const text = (document.body.innerText || "").replace(/\s+/g, " ").trim();
          return { text, wide: document.documentElement.scrollWidth, appError: /Application error|client-side exception|This page could not be found/i.test(text) };
        });
        await b.page.screenshot({ path: path.join(outDir, `${String(i + 1).padStart(2, "0")}-${name}.png`), fullPage: true });
        const problems = [];
        if (at.pathname !== want) problems.push(`landed on ${at.pathname}${at.search}`);
        if (b.errors.length) problems.push(`errors: ${b.errors.slice(0, 2).join(" | ").slice(0, 300)}`);
        if (seen.appError) problems.push("an error page");
        if (seen.text.length < 20 || seen.text.endsWith("Loading…")) problems.push(`next to nothing on the page: "${seen.text.slice(-60)}"`);
        if (seen.wide > width) problems.push(`${seen.wide}px wide`);
        check(!problems.length, `${url} → ${want}${problems.length ? `: ${problems.join("; ")}` : ""}`);
      }

      // The desk's Settings: no way to classic left.
      await b.page.goto(b.BASE + "/desk/settings", { waitUntil: "networkidle", timeout: 60000 });
      await b.page.locator("[data-desk-item]").first().waitFor({ timeout: 15000 }).catch(() => {});
      check((await b.page.locator('a[href="/admin"], [data-desk-item="classic"]').count()) === 0 && !/Classic admin/i.test(await b.page.innerText("body")), "the desk's Settings has no Classic admin row");

      // Nothing classic's admin called answers any more.
      const gone = [];
      for (const u of ["/api/admin/users", "/api/admin/shows", "/api/admin/leagues", "/api/admin/reports", "/api/admin/formats"]) {
        const r = await b.page.request.get(b.BASE + u);
        if (r.status() !== 404) gone.push(`${u} ${r.status()}`);
      }
      check(!gone.length, `classic's /api/admin routes are gone${gone.length ? `: ${gone.join(", ")}` : " (404)"}`);

      // Sign out while acting as the player: nobody is left signed in.
      const { rows: pl } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [PLAYER]);
      const act = await b.page.request.post(`${b.BASE}/api/desk/people/${pl[0].id}/act`, { data: {}, headers: { origin: b.BASE } });
      const me1 = await (await b.page.request.get(`${b.BASE}/api/me`)).json().catch(() => ({}));
      check(act.ok() && me1.user?.username === PLAYER && me1.impersonating === true, `acting as ${PLAYER}`);
      await b.page.goto(b.BASE + "/settings", { waitUntil: "networkidle", timeout: 60000 });
      await b.page.locator("[data-sign-out]").click();
      await b.page.waitForURL((u) => u.pathname === "/welcome", { timeout: 20000 }).catch(() => {});
      const me2 = await b.page.request.get(`${b.BASE}/api/me`);
      const { rows: ended } = await pool.query(`SELECT 1 FROM admin_changes WHERE entity = 'person' AND entity_id = $1 AND action = 'act-end'`, [pl[0].id]);
      check(me2.status() === 401 && ended.length === 1, `Sign out while acting: the hour ended in History, and nobody signed in after (${me2.status()})`);
    } finally {
      await b.close();
    }

    // ---------- a player: home, never the desk ----------
    const p = await open({ user: PLAYER, pass: PASSWORD, width, height: 844 });
    try {
      for (const url of ["/admin", "/admin/users"]) {
        await p.page.goto(p.BASE + url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
        const at = new URL(p.page.url()).pathname;
        check(!at.startsWith("/desk") && !at.startsWith("/admin"), `a player at ${url} goes home (${at}), not to the desk`);
      }
    } finally {
      await p.close();
    }

    // ---------- signed out: sign in, then back ----------
    const o = await open({ width, height: 844 });
    try {
      await o.page.goto(o.BASE + "/admin/users", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      const at = new URL(o.page.url());
      check(at.pathname === "/signin" && at.searchParams.get("next") === "/admin/users", `signed out: to sign in, coming back to /admin/users (${at.pathname}${at.search})`);
    } finally {
      await o.close();
    }
  } finally {
    if (!keep) await down(pool);
    await pool.end();
  }
  console.log(fails ? `${fails} FAIL` : "all PASS");
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
