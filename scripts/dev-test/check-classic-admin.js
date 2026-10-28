// Dev-only check that classic's admin still renders (docs/PLAN-desk-parity.md step 0), against the dev server, and that
// the desk's Settings › Classic admin row reaches it. Until step 8 retires classic's admin, a site admin on the new design
// still needs it for about 25 jobs, so every page under /admin has to come up. Also the check step 8 can turn round
// (every /admin page sends a site admin to the desk) once it's built.
//   1. A site admin of its own (zt_ca_admin, on no couch and in no league, `--ui=new|classic`, default new) signs in.
//   2. Every classic admin page at --width: the list pages, then one of each detail page (a show, its settings, a season,
//      its setup, cast, rules, an episode and its review, a user, a league, a format), taking the first of each kind the
//      lists return. A page passes when it has no page error, says more than "Loading…", isn't the admin gate's refusal,
//      and is no wider than the screen.
//   3. The desk's Settings has a Classic admin row linking to /admin, and tapping it opens classic's To do.
// Screenshots go to <outDir>. They show whatever the local database holds (a copy of production): keep them out of the
// repo (docs/HOSTING.md, The repo is public).
//
//   npm run dev                                                           (in another terminal)
//   node scripts/dev-test/check-classic-admin.js <outDir> [--width=390] [--ui=new|classic] [--keep]
//   node scripts/dev-test/check-classic-admin.js down                     (takes zt_ca_admin out, after --keep)
//
// Reads every page but writes nothing except its own admin, keyed on the zt_ca_ username, which `down` removes (and the
// run removes unless --keep). Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");

const DB = process.env.AUTH_DATABASE_URL || "";
const USER = "zt_ca_admin";
const PASSWORD = "zt-pass-12345";

const arg = (name, dflt) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1] || dflt;

async function up(pool, ui) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`,
    [id, USER, `${USER}@example.invalid`]
  );
  await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    crypto.randomUUID(), id, await hashPassword(PASSWORD),
  ]);
  await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET ui = $2`, [id, ui]);
  return id;
}

async function down(pool) {
  const { rows } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_ca\\_%'`);
  const ids = rows.map((r) => r.id);
  if (!ids.length) return;
  await pool.query(`DELETE FROM admin_changes WHERE user_id = ANY($1::text[])`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM user_settings WHERE user_id = ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM session WHERE "userId" = ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM account WHERE "userId" = ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [ids]);
}

// One of each detail page, from what the lists hold: the first show with a season that has episodes, the first user,
// league and format.
async function routes(as) {
  const out = [
    ["to-do", "/admin"], ["shows", "/admin/shows"], ["new-show", "/admin/shows/new"], ["users", "/admin/users"],
    ["leagues", "/admin/leagues"], ["formats", "/admin/formats"], ["reports", "/admin/reports"], ["site", "/admin/site"],
  ];
  const shows = (await as.call("GET", "/api/admin/shows")).body.shows || [];
  const show = shows.find((s) => s.seasons?.length) || shows[0];
  if (show) out.push(["show", `/admin/shows/${show.id}`], ["show-settings", `/admin/shows/${show.id}/settings`]);
  const season = show?.seasons?.[0];
  if (season) {
    const s = `/admin/seasons/${season.id}`;
    out.push(["season", s], ["season-setup", `${s}/setup`], ["season-cast", `${s}/cast`], ["season-rules", `${s}/rules`]);
    out.push(["episode", `${s}/episodes/1`], ["episode-review", `${s}/episodes/1/review`]);
  }
  const user = ((await as.call("GET", "/api/admin/users")).body.users || []).find((u) => u.username !== USER);
  if (user) out.push(["user", `/admin/users/${user.id}`]);
  const league = ((await as.call("GET", "/api/admin/leagues")).body.leagues || [])[0];
  if (league) out.push(["league", `/admin/leagues/${league.id}`]);
  const format = ((await as.call("GET", "/api/admin/formats")).body.formats || [])[0];
  if (format) out.push(["format", `/admin/formats/${format.id}`]);
  return out;
}

async function main() {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("refusing: AUTH_DATABASE_URL is not a local database");
  const pool = new Pool({ connectionString: DB });
  if (process.argv[2] === "down") {
    await down(pool);
    await pool.end();
    console.log("zt_ca_ admin removed");
    return;
  }
  const outDir = process.argv[2];
  if (!outDir || outDir.startsWith("--")) throw new Error("usage: check-classic-admin.js <outDir> [--width=390] [--ui=new|classic] [--keep]");
  fs.mkdirSync(outDir, { recursive: true });
  const width = Number(arg("width", "390"));
  const ui = arg("ui", "new");
  const keep = process.argv.includes("--keep");
  let fails = 0;
  const check = (ok, line) => {
    if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"} ${line}`);
  };

  try {
    await up(pool, ui);
    const as = await api({ user: USER, pass: PASSWORD });
    const b = await open({ user: USER, pass: PASSWORD, width, height: 844 });
    try {
      const list = await routes(as);
      for (const [i, [name, url]] of list.entries()) {
        b.errors.length = 0;
        const res = await b.page.goto(b.BASE + url, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => ({ status: () => String(e).slice(0, 80) }));
        await b.page.waitForTimeout(400);
        const seen = await b.page.evaluate(() => {
          const main = document.querySelector("main") || document.body;
          const text = (main.innerText || "").replace(/\s+/g, " ").trim();
          return { text, wide: document.documentElement.scrollWidth, appError: /Application error|client-side exception/i.test(document.body.innerText) };
        });
        const shot = path.join(outDir, `${String(i + 1).padStart(2, "0")}-${name}.png`);
        await b.page.screenshot({ path: shot, fullPage: true });
        const problems = [];
        if (res.status() !== 200) problems.push(`HTTP ${res.status()}`);
        if (b.errors.length) problems.push(`errors: ${b.errors.slice(0, 2).join(" | ").slice(0, 300)}`);
        if (seen.appError) problems.push("Application error");
        // A list with nothing in it still says so ("0 reports · Nothing open."); a blank page says nothing.
        if (seen.text.length < 20) problems.push(`next to nothing on the page: "${seen.text.slice(0, 60)}"`);
        if (/^Loading…$|Admin is only for site admins/.test(seen.text) || seen.text.endsWith("Loading…")) problems.push(`stuck: "${seen.text.slice(-60)}"`);
        if (seen.wide > width) problems.push(`${seen.wide}px wide`);
        check(!problems.length, `${url} renders${problems.length ? `: ${problems.join("; ")}` : ""}`);
      }

      // The desk's way to classic.
      b.errors.length = 0;
      await b.page.goto(b.BASE + "/desk/settings", { waitUntil: "networkidle", timeout: 60000 });
      const row = b.page.locator('a[href="/admin"]', { hasText: "Classic admin" });
      await row.first().waitFor({ timeout: 15000 }).catch(() => {});
      check((await row.count()) === 1, "the desk's Settings has one Classic admin row, linking to /admin");
      if (await row.count()) {
        await row.first().scrollIntoViewIfNeeded();
        await b.page.screenshot({ path: path.join(outDir, "desk-settings.png"), fullPage: true });
        await row.first().click();
        await b.page.waitForURL((u) => u.pathname === "/admin", { timeout: 20000 }).catch(() => {});
        // Classic boots on its first page (AuthGate), behind its boot screen: wait for To do's own content.
        await b.page.getByRole("heading", { name: "Needs you" }).waitFor({ timeout: 20000 }).catch(() => {});
        await b.page.waitForTimeout(500);
        const text = await b.page.evaluate(() => document.body.innerText);
        check(new URL(b.page.url()).pathname === "/admin" && /To do/.test(text) && !/Admin is only for site admins/.test(text), "tapping it opens classic's To do");
        await b.page.screenshot({ path: path.join(outDir, "desk-to-classic.png"), fullPage: true });
      }
      check(!b.errors.length, `no page errors on the desk${b.errors.length ? `: ${b.errors.slice(0, 2).join(" | ").slice(0, 300)}` : ""}`);
    } finally {
      await b.close();
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
