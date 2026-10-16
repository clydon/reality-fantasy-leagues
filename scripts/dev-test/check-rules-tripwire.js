// Dev-only test bank: research's rules tripwire, end to end in the admin UI. A pasted episode whose
// answer carries a rulesNote must show the "may have changed the rules" callout at the top of the
// result, mark the season's Rules tab, and its button must land on the Rules page with "Check for rule
// changes" already open. Also checks the opposite: a note-free paste shows no callout.
//
//   node scripts/dev-test/check-rules-tripwire.js up
//   node scripts/dev-test/check-rules-tripwire.js run <outDir> [width] [--dark] [--spoilers]   (needs `up` + npm run dev)
//   node scripts/dev-test/check-rules-tripwire.js down
//
// Makes a throwaway season (Survivor season 991, named "zt-rules", episode 4 aired last week) with a
// six-person approved cast on two tribes, and a throwaway admin, zt_admin / zt-pass-12345. `run`
// pastes a structured (JSON, free -- no model call) answer for episode 4 through the real UI and
// writes <outDir>/tripwire-*.png (Studio unless --dark; --spoilers shows the note itself). Every
// row is keyed on season 991 / "zt-rules" / zt_admin, so `down` can't touch real data. Never run
// against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const SEASON = 991;
const SEASON_NAME = "zt-rules";
const ADMIN = "zt_admin";
const PASSWORD = "zt-pass-12345";
const CAST = [
  ["Ada Zt", "Toka"], ["Bea Zt", "Toka"], ["Cal Zt", "Toka"],
  ["Dee Zt", "Savu"], ["Eli Zt", "Savu"], ["Fay Zt", "Savu"],
];
const NOTE = "A new 'Block a Vote' advantage was introduced: its holder can stop one player voting at the next Tribal.";
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

async function down(pool) {
  await pool.query(
    `DELETE FROM episode_research WHERE season_number=$1 AND show_id=(SELECT id FROM shows WHERE slug='survivor')`,
    [SEASON]
  );
  await pool.query(`DELETE FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]); // cast, decisions, rule changes cascade
  await pool.query(`DELETE FROM "user" WHERE username=$1`, [ADMIN]); // sessions/accounts cascade
}

async function up(pool) {
  await down(pool);
  const premiere = new Date(Date.now() - 4 * 7 * 864e5).toISOString().slice(0, 10);
  const { rows: show } = await pool.query(`SELECT id FROM shows WHERE slug='survivor'`);
  const { rows: season } = await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_count, results_by, cast_size, cast_approved_at)
     VALUES ($1,$2,$3,'airing',$4,'20:00','America/New_York',12,'admin',$5, now()) RETURNING id`,
    [show[0].id, SEASON, SEASON_NAME, premiere, CAST.length]
  );
  for (const [i, [name, tribe]] of CAST.entries()) {
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1,$2,$3,$4)`, [season[0].id, name, tribe, i]);
  }
  const { hashPassword } = await import("better-auth/crypto");
  const userId = id();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,true,$2,$2,'admin',now(),now())`,
    [userId, ADMIN, `${ADMIN}@example.invalid`]
  );
  await pool.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,'credential',$2,$3,now(),now())`,
    [id(), userId, await hashPassword(PASSWORD)]
  );
  console.log(`up: season ${season[0].id} (Survivor ${SEASON}), admin ${ADMIN} / ${PASSWORD}`);
  return season[0].id;
}

// A complete, sourced "nothing much happened" answer, optionally with a rules note.
function answer(rulesNote) {
  const R = require("../../db/episode-research.js");
  const ctx = { castNames: CAST.map((c) => c[0]), format: require("../../src/lib/game/formats/index.js").formatFor("survivor") };
  const a = R.pasteSkeleton(ctx, []);
  Object.assign(a, { episodeTitle: "Test", airDate: null, summary: "A quiet test episode.", tribalCouncilHeld: "no", rulesNote });
  if ("merged" in a) a.merged = "no";
  for (const c of a.castaways) for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
  for (const c of a.castaways) Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  return JSON.stringify(a);
}

async function paste(page, base, json) {
  await page.goto(`${base}/episodes/4`);
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByLabel("The chat's answer").fill(json);
  await page.getByRole("button", { name: "Add to review" }).click();
  await page.getByText(/Researched\.|Already researched/).first().waitFor({ timeout: 30000 });
}

async function run(pool, out, width, flags = []) {
  const fs = require("fs");
  fs.mkdirSync(out, { recursive: true });
  const { rows } = await pool.query(`SELECT id FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]);
  if (!rows.length) throw new Error("no fixture season: run `up` first");
  const { open, BASE } = require("./browser");
  const base = `${BASE}/admin/seasons/${rows[0].id}`;
  const { page, close } = await open({ user: ADMIN, pass: PASSWORD, width });
  const theme = flags.includes("--dark") ? "dark" : "light";
  const tag = `${width}-${theme}${flags.includes("--spoilers") ? "-spoilers" : ""}`;
  await page.addInitScript(
    ([t, spoilers]) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.admin.showSpoilers", spoilers ? "1" : "0");
    },
    [theme, flags.includes("--spoilers")]
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results = [];
  const check = (ok, what) => results.push(`${ok ? "PASS" : "FAIL"} ${what}`);
  try {
    // 1. No note: no callout.
    await paste(page, base, answer(null));
    check(!(await page.getByText("Rules changed?").count()), "no callout without a rules note");

    // 2. A note: callout up top, Rules tab marked.
    await pool.query(
      `DELETE FROM episode_research WHERE season_number=$1 AND show_id=(SELECT id FROM shows WHERE slug='survivor')`,
      [SEASON]
    );
    await paste(page, base, answer(NOTE));
    const callout = page.getByText("Rules changed?");
    check((await callout.count()) === 1, "callout shown with a rules note");
    await page.screenshot({ path: path.join(out, `tripwire-episode-${tag}.png`), fullPage: true });
    await page.goto(base); // the season page: its tab bar carries the marker
    const badge = page.getByText(/to check\)$/);
    await badge.first().waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
    check((await badge.count()) === 1, "Rules tab marked");
    await page.screenshot({ path: path.join(out, `tripwire-tabs-${tag}.png`) });

    // 3. The button lands on Rules with the check open.
    await paste(page, base, answer(NOTE)); // reused (cached) result still carries the note
    await page.getByRole("link", { name: /Rules changed\?/ }).click();
    await page.waitForURL(/\/rules\?check=1$/);
    const open = page.getByRole("button", { name: "Cancel check" });
    await open.waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("networkidle");
    check((await open.count()) === 1, "Rules page opened with the check started");
    await page.screenshot({ path: path.join(out, `tripwire-rules-${tag}.png`), fullPage: true });
  } finally {
    await close();
  }
  for (const r of results) console.log(r);
  for (const e of errors) console.log("page error:", e);
  if (results.some((r) => r.startsWith("FAIL")) || errors.length) process.exitCode = 1;
}

(async () => {
  const [cmd, out, width = "390", ...flags] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    if (cmd === "up") await up(pool);
    else if (cmd === "down") { await down(pool); console.log("down: removed"); }
    else if (cmd === "run" && out) await run(pool, out, parseInt(width, 10), flags);
    else throw new Error("usage: check-rules-tripwire.js up | run <outDir> [width] | down");
  } finally {
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
