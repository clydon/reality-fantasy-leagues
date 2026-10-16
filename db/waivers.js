// The waiver clock, hourly (docs/PLAN-midseason-waivers.md, phase 3): processes every waiver week whose
// time has come -- and opens and closes them -- in leagues nobody has loaded since, so "Waivers
// processed" goes out on time; then the reminders six hours before a week processes.
//
//   node db/waivers.js          # do whatever is due now
//   node db/waivers.js --dry    # say what would happen; change, record and send nothing
//
// Run hourly by .github/workflows/auto-research.yml, after reminders.js. The app runs the same clock
// lazily (withLeagueLock in src/lib/server/db.ts, on any write or a load with a step due), with the same
// code (src/lib/server/waivers.js syncWaivers) under the same row lock, so a week processes exactly
// once whichever gets there first, and whoever processed it announces it (waiver-pushes.js
// sendProcessed). Reminders go out at most once each (reminder_log), so running this more often only
// makes it more punctual.
//
// Only leagues with Pickups or Add/drops on (WaiverLogic.enabled decides the rest). Air times are stamped from the catalog
// as the app stamps them (src/lib/server/air-times.ts); a league with no season, or catching up, has
// none, and its weeks run on hours since opening instead (WaiverLogic.schedule).
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { syncWaivers } = require("../src/lib/server/waivers.js");
const WP = require("../src/lib/server/waiver-pushes.js");
const { loadSeasons } = require("./auto-research.js");

// Each episode's air time from the league's season (air-times.ts's rule, on seasons loaded once).
function stampAirTimes(state, seasons) {
  const { showId, wikiSeason } = state.settings || {};
  const season = showId && wikiSeason != null ? seasons.get(`${showId}|${wikiSeason}`) : null;
  const catchingUp = StateLogic.RevealLogic.isCatchingUp(state);
  for (const ep of state.episodes) {
    const at = season && !catchingUp ? Air.episodeAirTime(season.schedule, ep.number, season.wikiAirDates) : null;
    if (at) ep.airsAt = at.toISOString();
    else delete ep.airsAt;
  }
}

async function runWaivers(pool, opts = {}) {
  const now = opts.now || Date.now();
  const log = opts.log || ((line) => console.log(`[waivers] ${line}`));
  const seasons = new Map((await loadSeasons(pool, "TRUE")).map((s) => [`${s.slug}|${s.season_number}`, s]));
  const { rows } = await pool.query(
    "SELECT id FROM leagues WHERE state->'settings'->>'replenishEnabled' = 'true' OR state->'settings'->>'tradeEnabled' = 'true'"
  );
  // opts.leagueIds: only these (the dev test bank's, scripts/dev-test/check-waivers-alerts.js).
  const only = opts.leagueIds ? new Set(opts.leagueIds) : null;
  let steps = 0;
  let announced = 0;
  let reminded = 0;
  for (const { id } of rows) {
    if (only && !only.has(id)) continue;
    try {
      const league = await stepLeague(pool, id, seasons, now, { ...opts, log });
      if (!league) continue;
      steps += league.steps;
      announced += league.announced;
      reminded += await WP.remindWaivers(pool, league, now, { dry: opts.dry, log });
    } catch (e) {
      // One league's bad state mustn't hold up every other league's waivers.
      console.error(`[waivers] league ${id}:`, e.message);
    }
  }
  return { steps, announced, reminded };
}

// One league under its row lock: every step due, written back, then announced.
async function stepLeague(pool, id, seasons, now, opts) {
  const client = await pool.connect();
  let league;
  let processed = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT name, state FROM leagues WHERE id=$1 FOR UPDATE", [id]);
    if (!rows.length) {
      await client.query("ROLLBACK");
      return null;
    }
    const state = rows[0].state;
    stampAirTimes(state, seasons);
    const before = WP.snapshot(state);
    let events = [];
    if (StateLogic.WaiverLogic.due(state, now)) {
      events = await syncWaivers(client, id, state, now);
      StateLogic.ensureNextEpisode(state);
    }
    if (events.length && !opts.dry) {
      await client.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), id]);
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
    events.forEach((e) => opts.log(`${opts.dry ? "(dry) " : ""}${rows[0].name}: Episode ${e.episode}'s week ${e.type}`));
    processed = WP.justProcessed(before, state);
    league = { id, name: rows[0].name, state, steps: events.length, announced: 0 };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  // After the commit, never inside it: a push for a week that was then rolled back would be a lie.
  if (processed) league.announced = await WP.sendProcessed(pool, id, league.state, processed, { dry: opts.dry, log: opts.log });
  return league;
}

module.exports = { runWaivers };

if (require.main === module) {
  const dry = process.argv.includes("--dry");
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  runWaivers(pool, { dry })
    .then(({ steps, announced, reminded }) =>
      console.log(`[waivers] ${steps} step${steps === 1 ? "" : "s"}, ${announced} processed push${announced === 1 ? "" : "es"}, ${reminded} reminder${reminded === 1 ? "" : "s"} ${dry ? "due" : "sent"}`)
    )
    .catch((e) => {
      console.error("[waivers] failed:", e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
