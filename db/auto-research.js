// Scheduled episode research (db/migrations/0020): for every season with auto-research on, research
// each episode whose weekly research slot has come round since it aired -- e.g. "Thursdays at noon
// Eastern" researches Wednesday night's episode. What it finds is staged as season decisions for an
// admin to review, exactly like the manual Research button; nothing reaches a league by itself.
//
//   node db/auto-research.js          # run whatever is due now
//   node db/auto-research.js --dry    # say what's due, research nothing
//
// Run hourly by .github/workflows/auto-research.yml. Hourly is the resolution: a noon slot is picked
// up by the first run after noon.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Air = require("../src/lib/game/air-schedule.js");

// A failed attempt is retried, but not every hour -- a provider outage or a bad key shouldn't turn
// into 24 paid calls a day -- and not forever.
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const DEFAULT_MODEL = "claude-haiku-4-5";

/** One season's schedule as air-schedule.js wants it, plus what the runner needs around it. */
async function loadSeasons(pool, where = "ss.auto_research", params = []) {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, s.slug, s.id AS show_id,
            to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz,
            ss.auto_research, ss.research_weekday, to_char(ss.research_time, 'HH24:MI') AS research_time,
            ss.research_model, ss.auto_research_since, ss.episode_count,
            (SELECT json_object_agg(e->>'number', e->>'airDate')
               FROM wiki_extractions we, jsonb_array_elements(we.payload->'episodes') e
              WHERE we.show_id = s.id AND we.season_number = ss.season_number AND we.kind = 'episodes'
                AND e->>'airDate' IS NOT NULL) AS wiki_air_dates,
            COALESCE((SELECT array_agg(er.episode_number) FROM episode_research er
                       WHERE er.show_id = s.id AND er.season_number = ss.season_number), '{}') AS researched
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE ${where}`,
    params
  );
  return rows.map((r) => ({
    ...r,
    schedule: {
      premiereDate: r.premiere_date,
      airTime: r.air_time,
      airTz: r.air_tz,
      researchWeekday: r.research_weekday,
      researchTime: r.research_time,
    },
    wikiAirDates: r.wiki_air_dates || {},
  }));
}

/** When episode n of a season airs (null when unknown) -- the research route's "has it aired?" check. */
async function episodeAirsAt(pool, seasonId, n) {
  const [season] = await loadSeasons(pool, "ss.id = $1", [seasonId]);
  if (!season) return null;
  return Air.episodeAirTime(season.schedule, n, season.wikiAirDates);
}

/** The season's known episode count (0029), or null when nobody has set one. */
async function episodeCountOf(pool, seasonId) {
  const { rows } = await pool.query("SELECT episode_count FROM show_seasons WHERE id=$1", [seasonId]);
  return rows.length ? rows[0].episode_count : null;
}

/** Episodes of one season that are due for scheduled research at `now`. */
async function dueEpisodes(pool, season, now) {
  if (!season.auto_research || season.research_weekday == null || !season.research_time) return [];
  const since = season.auto_research_since ? new Date(season.auto_research_since) : now;
  const researched = new Set(season.researched.map(Number));
  const due = [];
  // Weekly from the premiere runs past the finale forever; the season's real length stops it (0029).
  const last = season.episode_count || 60;
  for (let n = 1; n <= last; n++) {
    const air = Air.episodeAirTime(season.schedule, n, season.wikiAirDates);
    if (!air || air > now) break;
    if (researched.has(n)) continue;
    const slot = Air.nextResearchSlot(air, season.schedule);
    if (!slot || slot > now || slot < since) continue;
    const { rows: attempts } = await pool.query(
      `SELECT attempted_at FROM auto_research_attempts
        WHERE season_id=$1 AND episode_number=$2 AND attempted_at >= $3 AND NOT ok
        ORDER BY attempted_at DESC`,
      [season.id, n, slot]
    );
    if (attempts.length >= MAX_ATTEMPTS) continue;
    if (attempts.length && now - new Date(attempts[0].attempted_at) < RETRY_AFTER_MS) continue;
    due.push(n);
  }
  return due;
}

async function runDue(pool, opts = {}) {
  // Required lazily: the research module pulls in the SDKs, which the route's air check doesn't need.
  const { researchSeasonEpisode } = require("./episode-research.js");
  const now = opts.now || new Date();
  const seasons = await loadSeasons(pool);
  let ran = 0;
  for (const season of seasons) {
    const due = await dueEpisodes(pool, season, now);
    for (const n of due) {
      const label = `${season.slug} season ${season.season_number} episode ${n}`;
      if (opts.dry) {
        console.log(`[auto-research] due: ${label}`);
        continue;
      }
      console.log(`[auto-research] researching ${label}`);
      try {
        const run = await researchSeasonEpisode(pool, season.slug, season.season_number, n, {
          provider: "anthropic",
          model: season.research_model || DEFAULT_MODEL,
        });
        const d = run.decisions || {};
        await pool.query(
          "INSERT INTO auto_research_attempts (season_id, episode_number, ok, message) VALUES ($1,$2,true,$3)",
          [season.id, n, `${d.inserted || 0} new result(s) to review`]
        );
        ran++;
      } catch (e) {
        console.error(`[auto-research] ${label}: ${e.message}`);
        await pool.query(
          "INSERT INTO auto_research_attempts (season_id, episode_number, ok, message) VALUES ($1,$2,false,$3)",
          [season.id, n, String(e.message).slice(0, 500)]
        );
      }
    }
  }
  console.log(`[auto-research] done: ${ran} episode(s) researched`);
  return ran;
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  runDue(pool, { dry: process.argv.includes("--dry") })
    .catch((e) => {
      console.error("[auto-research] " + e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { loadSeasons, dueEpisodes, runDue, episodeAirsAt, episodeCountOf, RETRY_AFTER_MS, MAX_ATTEMPTS };
