// A season's air clock for the hourly jobs and the bot (db/reminders.js, db/waivers.js, db/bot-research.js): each season's
// schedule as src/lib/game/air-schedule.js wants it, and whether it's still live. Moved here from db/auto-research.js when paid
// Claude research's hourly run went (docs/PLAN-desk-parity.md, decision 9 and step 8, part 8b); the same two functions, the same
// shapes, less paid research's own fields (its weekly slot, its model, what it had researched), which nothing reads now.
//
// Plain CommonJS under bare `node`, like the rest of db/.
const Air = require("../src/lib/game/air-schedule.js");

/** Seasons matching `where` (SQL over show_seasons ss and shows s), each with its schedule as air-schedule.js wants it. */
async function loadSeasons(pool, where, params = []) {
  // No default: auto-research's was its own switch, and a caller that forgot would read every season or none without a word.
  if (typeof where !== "string" || !where.trim()) throw new Error("loadSeasons: say which seasons (a WHERE over ss and s)");
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, s.slug, s.id AS show_id,
            to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz,
            ss.episode_count, ss.status,
            ss.bot_research_on, ss.bot_research_schedule, ss.bot_research_since, ss.episode_minutes,
            to_char(ss.finale_date, 'YYYY-MM-DD') AS finale_date,
            -- The wiki's dates with research-confirmed starts over them, and confirmed lengths (0067).
            sad.air_dates AS wiki_air_dates, sad.runtimes AS episode_runtimes
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       LEFT JOIN season_air_dates sad ON sad.season_id = ss.id
      WHERE ${where}`,
    params
  );
  return rows.map((r) => ({
    ...r,
    schedule: {
      premiereDate: r.premiere_date,
      airTime: r.air_time,
      airTz: r.air_tz,
    },
    wikiAirDates: r.wiki_air_dates || {},
    episodeRuntimes: r.episode_runtimes || {},
  }));
}

// A few days after the finale, so its results still get picked up.
const FINALE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Whether a season is still worth running for: set to "airing", and not past its finale (the finale date if set, else the last
 * episode's air time when the episode count and schedule are known) by more than the grace period.
 */
function isSeasonLive(season, now = new Date()) {
  if (season.status !== "airing") return false;
  let end = null;
  if (season.finale_date) end = new Date(`${season.finale_date}T23:59:59Z`);
  else if (season.episode_count) end = Air.episodeAirTime(season.schedule, season.episode_count, season.wikiAirDates);
  return !end || now.getTime() <= end.getTime() + FINALE_GRACE_MS;
}

module.exports = { loadSeasons, isSeasonLive };
