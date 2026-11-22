// Admin's Back from a page opened from outside admin (docs/design-round/admin-audit-tasks.md, "The worst ten" 1: read from the code
// as "Back can trap you"). Signed in as a zt site admin at a phone's width, it opens a season's admin page two ways — straight from a
// link, and through a show menu's "This season in Admin" — then taps the header's Back up to five times, recording where each lands.
// It passes when Back reaches an admin tab (/desk, /desk/find or /desk/settings) or leaves admin, without visiting a page twice.
// Needs: the app on :3000 (npm run dev). Brings the zt_nd couch up and takes it down (new-fixture.js); zt rows only.
// Run: node scripts/dev-test/check-admin-back.js [--width=390] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");
const fixture = require("./new-fixture");

const args = process.argv.slice(2);
const WIDTH = Number(args.find((a) => a.startsWith("--width="))?.slice(8) ?? 390);
const ADMIN = "zt_nd_backcheck";
let bad = 0;
const check = (ok, what, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` ${extra}`}`);
  if (!ok) bad++;
};

/** A zt site admin (a zt_nd_ person, so new-fixture's down removes them with the rest). */
async function siteAdmin(db) {
  const { hashPassword } = await import("better-auth/crypto");
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, $2, $2, 'admin', true, now(), now())`,
    [id, ADMIN, `${ADMIN}@example.invalid`]
  );
  await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    crypto.randomUUID(),
    id,
    await hashPassword(fixture.PASSWORD),
  ]);
  await db.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
}

/** Taps the admin header's Back up to five times; the path after each tap. */
async function backs(page) {
  const seen = [new URL(page.url()).pathname];
  for (let i = 0; i < 5; i++) {
    const back = page.locator("[data-desk-back]").first();
    if (!(await back.count())) break; // left admin
    await back.click();
    await page.waitForTimeout(1800);
    const p = new URL(page.url()).pathname;
    seen.push(p);
    if (/^\/desk(\/(find|settings))?$/.test(p) || !p.startsWith("/desk")) break;
  }
  return seen;
}

const fine = (seen) => {
  const last = seen[seen.length - 1];
  const reached = /^\/desk(\/(find|settings))?$/.test(last) || !last.startsWith("/desk");
  const twice = seen.some((p, i) => seen.indexOf(p) !== i);
  return { reached, twice };
};

(async () => {
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const fx = await fixture.up(db);
    await siteAdmin(db);
    const S = fx.seasonId;
    // 1. Straight from a link: a new tab on a season's admin page.
    const a = await open({ user: ADMIN, pass: fixture.PASSWORD, width: WIDTH, height: 844, motion: "reduce" });
    try {
      await a.page.goto(`${BASE}/desk/season/${S}`);
      await a.page.locator("[data-desk-back]").first().waitFor({ timeout: 45000 });
      await a.page.waitForTimeout(1500);
      const seen = await backs(a.page);
      console.log(`  from a link: ${seen.join(" → ")}`);
      const { reached, twice } = fine(seen);
      check(reached && !twice, "from a link, Back reaches an admin tab or leaves admin without going round in a circle", seen.join(" → "));
    } finally {
      await a.close();
    }
    // 2. Through the show menu's door.
    const b = await open({ user: ADMIN, pass: fixture.PASSWORD, width: WIDTH, height: 844, motion: "reduce" });
    try {
      await b.page.goto(`${BASE}/show/${S}/tonight`);
      const menu = b.page.locator('button[aria-label^="Show menu"]').first();
      await menu.waitFor({ timeout: 45000 });
      await b.page.waitForTimeout(1200);
      await menu.click();
      const door = b.page.locator('[role="dialog"] :text("in Admin")').first();
      await door.waitFor({ timeout: 10000 });
      await door.click();
      await b.page.locator("[data-desk-back]").first().waitFor({ timeout: 45000 });
      await b.page.waitForTimeout(1500);
      const seen = await backs(b.page);
      console.log(`  from the show menu: ${seen.join(" → ")}`);
      const { reached, twice } = fine(seen);
      check(reached && !twice, "from the show menu's door, Back reaches an admin tab or leaves admin without going round in a circle", seen.join(" → "));
    } finally {
      await b.close();
    }
  } finally {
    if (!args.includes("--keep")) await fixture.down(db);
    await db.end();
  }
  console.log(bad ? `${bad} FAILED` : "ALL PASS");
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
