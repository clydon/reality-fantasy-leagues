// Dev-only check: the bot research clock's `next` (db/bot-research.js planRuns, /api/cron/bot-research), on a
// zt season with a test clock and no bot: runs count from an episode's end (air time + episode length), a
// failed quick check comes back 5 minutes later, then the full run, and a call with nothing due runs nothing
// and says when to come back. The VM's tick (llm-browser-api deploy/tick.py) only calls at those times.
//
//   npm run dev                                   (in another terminal; .env.local needs CRON_SECRET)
//   node scripts/dev-test/check-bot-clock.js      makes the zt-botclock show, checks, removes it
//     --ui=<outDir> [--width=390]                 also, as linked-fixture's admin zt_tester, the season's
//                                                 Setup page: the episode length stepper saves
//
// Never asks the real bot: every call is GET ?dry=1, or a POST when nothing is due. Refuses a non-local
// database, and stops if any other local season has bot research on (it would share the clock).
require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const { Pool } = require("pg");

const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-bot-clock runs against a local database only");
if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET isn't in .env.local");
const SLUG = "zt-botclock";

// Wednesdays at 8 PM Eastern from 7 October 2026: episode 3 starts 2026-10-22T00:00Z and, at 90 minutes,
// ends 01:30Z.
const clock = (method, now) =>
  fetch(`${BASE}/api/cron/bot-research?dry=1&now=${encodeURIComponent(now)}`, {
    method,
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

async function down(pool) {
  await pool.query("DELETE FROM shows WHERE slug = $1", [SLUG]); // the season and its runs go with it
}

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3) || null;

// The admin's side: Setup › Bot research shows the length (90) and its stepper saves 95.
async function ui(pool, season, out, width) {
  const linked = require("./linked-fixture");
  const { open } = require("./browser");
  await pool.query("UPDATE show_seasons SET bot_research_on = true, episode_minutes = 90 WHERE id = $1", [season]);
  await linked.up(pool); // zt_tester is an admin
  const { page, errors, close } = await open({ user: linked.USERNAME, pass: linked.PASSWORD, width, motion: "off" });
  try {
    await page.goto(`${BASE}/admin/seasons/${season}/setup`, { waitUntil: "networkidle" });
    const more = page.getByRole("button", { name: "Episode length, minutes: one more" });
    await more.scrollIntoViewIfNeeded();
    await page.getByText("Each run counts from when an episode ends").waitFor();
    await page.getByText("Quick check, 5 min after it ends").waitFor();
    await page.screenshot({ path: `${out}/bot-clock-setup-${width}.png` });
    await more.click();
    for (let i = 0; i < 20; i++) {
      const { rows } = await pool.query("SELECT episode_minutes FROM show_seasons WHERE id = $1", [season]);
      if (rows[0].episode_minutes === 95) break;
      await page.waitForTimeout(250);
    }
    const { rows } = await pool.query("SELECT episode_minutes FROM show_seasons WHERE id = $1", [season]);
    assert.equal(rows[0].episode_minutes, 95, "one tap: 90 -> 95, saved");
    assert.deepEqual(errors, [], "no console errors");
  } finally {
    await close();
    await linked.down(pool);
  }
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    await down(pool);
    const { rows: others } = await pool.query("SELECT count(*)::int AS n FROM show_seasons WHERE bot_research_on");
    if (others[0].n) throw new Error(`${others[0].n} local season(s) already have bot research on; their runs would mix in`);
    const show = (await pool.query(`INSERT INTO shows (slug, name) VALUES ($1, 'ZT Bot Clock') RETURNING id`, [SLUG])).rows[0].id;
    const season = (
      await pool.query(
        `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_count, episode_minutes,
                                   bot_research_on, bot_research_since)
         VALUES ($1, 1, 'ZT Bot Clock 1', 'airing', '2026-10-07', '20:00', 'America/New_York', 13, 90, true, '2026-10-20T00:00Z') RETURNING id`,
        [show]
      )
    ).rows[0].id;
    const tried = (slot, at, ok) =>
      pool.query(`INSERT INTO bot_research_runs (season_id, episode_number, slot, kind, started_at, finished_at, ok) VALUES ($1, 3, $2, $3, $4, $4, $5)`, [
        season,
        slot,
        slot.split("@")[0],
        at,
        ok,
      ]);

    // Before episode 3: nothing due, come back 5 minutes after it ends (episodes 1 and 2 aired before the switch-on).
    let r = await clock("GET", "2026-10-21T23:00:00Z");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.due, []);
    assert.equal(r.body.next, "2026-10-22T01:35:00.000Z", "quick check 5 minutes after a 90-minute episode ends");
    r = await clock("POST", "2026-10-21T23:00:00Z");
    assert.equal(r.body.job, null, "a call with nothing due runs nothing");
    assert.equal(r.body.next, "2026-10-22T01:35:00.000Z", "and says when to come back");

    // Its time: due, and next is now.
    r = await clock("GET", "2026-10-22T01:36:00Z");
    assert.deepEqual(r.body.due.map((d) => `${d.episode} ${d.slot}`), ["3 quick@5"]);
    assert.equal(r.body.next, "2026-10-22T01:36:00.000Z");

    // No source yet: back in 5 minutes. Found: next is the full run, an hour after the end.
    await tried("quick@5", "2026-10-22T01:36:00Z", false);
    r = await clock("GET", "2026-10-22T01:37:00Z");
    assert.deepEqual(r.body.due, []);
    assert.equal(r.body.next, "2026-10-22T01:41:00.000Z");
    await tried("quick@5", "2026-10-22T01:41:00Z", true);
    r = await clock("GET", "2026-10-22T01:42:00Z");
    assert.equal(r.body.next, "2026-10-22T02:30:00.000Z");

    // The episode length moves everything: at an hour, the full run is due at 02:00.
    await pool.query("UPDATE show_seasons SET episode_minutes = NULL WHERE id = $1", [season]);
    r = await clock("GET", "2026-10-22T01:42:00Z");
    assert.equal(r.body.next, "2026-10-22T02:00:00.000Z", "no length set: an hour");

    // Switched off: nothing scheduled at all.
    await pool.query("UPDATE show_seasons SET bot_research_on = false WHERE id = $1", [season]);
    r = await clock("GET", "2026-10-22T01:42:00Z");
    assert.equal(r.body.next, null);

    if (arg("ui")) await ui(pool, season, arg("ui"), parseInt(arg("width") || "390", 10));

    console.log("check-bot-clock: all good");
  } finally {
    await down(pool);
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
