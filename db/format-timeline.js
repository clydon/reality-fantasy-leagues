// The season's format state over time, from the database (docs/PLAN-start-a-game-gpt.md, "Formats nobody announced", F3
// part 2). src/lib/game/formats/format-timeline.js builds it from each episode's report; this reads the reports from a
// season's stored combined research (its format section, who it has going home, `merged`) and builds it, on read: one query a
// season, never stored, so a corrected answer works out everything after it the next time anything reads it (the plan's
// Noticed says when a cache would be worth it).
//
// What reads it: the research context (db/episode-research.js: the groups going into an episode, formatGoingIntoFrom; the
// newcomers still in, asked about like anyone; the season's word for its groups), A6's group questions on a season played in
// pairs the league doesn't hold (src/lib/server/answer-points.ts formatGroupsFor), and the desk's cue for someone research says
// came in that the season's cast doesn't have yet (seasonNewcomerCues: adding them stays a person's).
const Timeline = require("../src/lib/game/formats/format-timeline.js");

// Each stored combined answer of a season, as little of it as the timeline reads: its format section, `merged`, and the
// names of who it has going home (worked out in the database, so the checklists' sources and notes never leave it).
const REPORTS = `SELECT episode_number, payload->'formatState' AS state, payload->>'merged' AS merged,
       COALESCE((SELECT jsonb_agg(c->>'name') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(payload->'castaways') = 'array' THEN payload->'castaways' ELSE '[]'::jsonb END) c
                  WHERE jsonb_typeof(c) = 'object' AND c->>'leftTheGame' = 'yes'), '[]'::jsonb) AS left_names
  FROM episode_research
 WHERE show_id=$1 AND season_number=$2 AND source = 'combined' AND episode_number < $3
 ORDER BY episode_number`;

// The same for a show by its slug (a league's settings.showId), in one query.
const REPORTS_BY_SLUG = REPORTS.replace(
  "FROM episode_research\n WHERE show_id=$1",
  "FROM episode_research\n WHERE show_id = (SELECT id FROM shows WHERE slug = $1)"
);

/** One stored row as the timeline's report (format-timeline.js reportFrom). Pure. */
function reportOf(row) {
  const left = (Array.isArray(row.left_names) ? row.left_names : []).filter((n) => typeof n === "string" && n);
  return Timeline.reportFrom(Number(row.episode_number), { formatState: row.state, castaways: left.map((name) => ({ name, leftTheGame: "yes" })), merged: row.merged });
}

/**
 * The reports of a season's episodes before `before` (all of them without it), in order, from its stored combined research.
 */
async function seasonReports(pool, { showId, season, before = null }) {
  if (!showId || season == null) return [];
  const { rows } = await pool.query(REPORTS, [showId, Number(season), Number.isInteger(before) ? before : 2147483647]);
  return rows.map(reportOf);
}

/**
 * The season's format state over time (format-timeline.js buildTimeline) from its stored research, the episodes before `before`
 * only when it's given (what was known going into that episode). `cast`: the names research asks about.
 */
async function seasonFormatTimeline(pool, { showId, season, cast = [], before = null }) {
  return Timeline.buildTimeline(await seasonReports(pool, { showId, season, before }), { cast });
}

/** The same for a season by its catalogue row (show_seasons.id), its cast the season's (season_cast). Null for no such season. */
async function timelineForSeason(pool, seasonId) {
  const { rows } = await pool.query(
    `SELECT ss.show_id, ss.season_number, COALESCE(array_agg(sc.name ORDER BY sc.sort_order, sc.name) FILTER (WHERE sc.name IS NOT NULL), '{}') AS cast_names
       FROM show_seasons ss LEFT JOIN season_cast sc ON sc.season_id = ss.id
      WHERE ss.id = $1 GROUP BY ss.show_id, ss.season_number`,
    [seasonId]
  );
  if (!rows.length) return null;
  const tl = await seasonFormatTimeline(pool, { showId: rows[0].show_id, season: rows[0].season_number, cast: rows[0].cast_names });
  return { timeline: tl, cast: rows[0].cast_names };
}

/** The same for a league's season, by the show's slug and the season's number (a league's settings.showId and wikiSeason), in
 *  one query; null when the league names no season. */
async function timelineForShow(pool, showSlug, season, cast = []) {
  if (!showSlug || season == null || !Number.isFinite(Number(season))) return null;
  const { rows } = await pool.query(REPORTS_BY_SLUG, [showSlug, Number(season), 2147483647]);
  return Timeline.buildTimeline(rows.map(reportOf), { cast });
}

/**
 * The desk's cue (F3 part 2): who research says came in that the season's cast doesn't have yet (format-timeline.js
 * newcomerCues: name, the episode they came in, who for, the group they joined, the episode they left), for a person to add
 * to the cast every league sees. Research already asks about them, and stages their results and exit at the season level;
 * those reach a game once they're on its cast. [] for no such season.
 */
async function seasonNewcomerCues(pool, seasonId) {
  const got = await timelineForSeason(pool, seasonId);
  return got ? Timeline.newcomerCues(got.timeline, got.cast) : [];
}

module.exports = { REPORTS, REPORTS_BY_SLUG, reportOf, seasonReports, seasonFormatTimeline, timelineForSeason, timelineForShow, seasonNewcomerCues };
