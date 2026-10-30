// Dev-only check: the bot research clock's `next` (db/bot-research.js planRuns, /api/cron/bot-research), on a
// zt season with a test clock and no bot: runs count from an episode's end (air time + episode length), a
// failed quick check comes back 5 minutes later, then the full run, and a call with nothing due runs nothing
// and says when to come back. The VM's tick (llm-browser-api deploy/tick.py) only calls at those times.
//
//   npm run dev                                   (in another terminal; .env.local needs CRON_SECRET)
//   node scripts/dev-test/check-bot-clock.js      makes the zt-botclock show, checks, removes it
//   (its old --ui, classic's Setup page, retired with classic's admin: the desk's Research page and its episode length
//   are check-desk-research.js's)
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


// The admin's side: Setup › Bot research shows the length (90) and its stepper saves 95.
(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    await down(pool);
    const { rows: others } = await pool.query("SELECT count(*)::int AS n FROM show_seasons WHERE bot_research_on");
    if (others[0].n) throw new Error(`${others[0].n} local season(s) already have bot research on; their runs would mix in`);
    const show = (await pool.query(`INSERT INTO shows (slug, name) VALUES ($1, 'ZT Bot Clock') RETURNING id`, [SLUG])).rows[0].id;
    const season = (
      await pool.query(
        // The schedule this checks: the quick check and the two full runs (trivia's and bingo's runs, added to the default
        // schedule since, have checks of their own: check-trivia-research.js, check-bingo-bank.js).
        `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_count, episode_minutes,
                                   bot_research_on, bot_research_since, bot_research_schedule)
         VALUES ($1, 1, 'ZT Bot Clock 1', 'airing', '2026-10-07', '20:00', 'America/New_York', 13, 90, true, '2026-10-20T00:00Z',
                 '[{"kind":"quick","after":5,"on":true},{"kind":"full","after":60,"on":true},{"kind":"full","after":540,"on":true}]') RETURNING id`,
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

    // Episode 3's research says episode 4 comes a week late (Nov 4, 8 PM Eastern) and runs two hours
    // (db/episode-research.js recordNextEpisode -> season_episodes, 0067): the clock follows both.
    const Research = require("../../db/episode-research.js");
    const told = await Research.recordNextEpisode(
      pool,
      { showId: show, season: 1, episodeNumber: 3, showName: "ZT Bot Clock" },
      { airsAt: "2026-11-04T20:00:00-05:00", minutes: 120, note: "after a week off" }
    );
    assert.equal(told && told.minutes, 120, "recorded");
    r = await clock("GET", "2026-10-28T01:00:00Z"); // when episode 4 would have aired
    assert.deepEqual(r.body.due, [], "not on the usual night");
    assert.equal(r.body.next, "2026-11-05T03:05:00.000Z", "its quick check: 8 PM EST Nov 4, plus two hours, plus 5 minutes");
    // An admin's correction (source 'admin') is never overwritten by later research.
    await pool.query("UPDATE season_episodes SET source = 'admin', runtime_min = 90 WHERE season_id = $1 AND number = 4", [season]);
    await Research.recordNextEpisode(pool, { showId: show, season: 1, episodeNumber: 3 }, { airsAt: null, minutes: 150 });
    const { rows: kept } = await pool.query("SELECT runtime_min FROM season_episodes WHERE season_id = $1 AND number = 4", [season]);
    assert.equal(kept[0].runtime_min, 90, "the admin's length stands");

    // The schedule check (0068): episode 4's run asks only when episode 5 airs and files it, with nothing to
    // review. A stand-in bot answers; the run is recorded like any other.
    const Bot = require("../../db/bot-research.js");
    const job = { season: await Bot.loadSeasonForJob(pool, season), episode: 4, kind: "schedule", slot: "schedule@30" };
    const said = (json) => async () => ({ answer: "```json\n" + json + "\n```" });
    const ran = await Bot.runJob(pool, job, { ask: said('{"found": true, "airsAt": "2026-11-11T20:00:00-05:00", "minutes": 120, "note": "two-hour episode", "sources": []}') });
    assert.equal(ran.ok, true, ran.message);
    const { rows: ep5 } = await pool.query("SELECT air_at, runtime_min, note, reported_in FROM season_episodes WHERE season_id = $1 AND number = 5", [season]);
    assert.equal(ep5[0].air_at.toISOString(), "2026-11-12T01:00:00.000Z");
    assert.equal(ep5[0].runtime_min, 120);
    assert.equal(ep5[0].reported_in, 4);
    const notYet = await Bot.runJob(pool, job, { ask: said('{"found": false, "airsAt": null, "minutes": null}') });
    assert.equal(notYet.ok, false, "no source yet: a failed try, asked again later");
    const { rows: kinds } = await pool.query("SELECT kind, ok FROM bot_research_runs WHERE season_id = $1 ORDER BY started_at", [season]);
    assert.deepEqual(kinds.slice(-2).map((k) => `${k.kind}:${k.ok}`), ["schedule:true", "schedule:false"]);

    // Switched off: nothing scheduled at all.
    await pool.query("UPDATE show_seasons SET bot_research_on = false WHERE id = $1", [season]);
    r = await clock("GET", "2026-10-22T01:42:00Z");
    assert.equal(r.body.next, null);


    console.log("check-bot-clock: all good");
  } finally {
    await down(pool);
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
