// Staging episode results as SEASON decisions (db/migrations/0019) -- the one place both connectors
// write what they found. db/wiki-sync.js stages a season's wiki read; db/episode-research.js stages
// one episode's research. An admin then decides each row once, and src/lib/server/season-decisions.ts
// applies the accepted ones to every league on the season.
//
// Plain CommonJS so both connector scripts can require it under bare `node`.
const StateLogic = require("../src/lib/game/state-logic.js");

const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 };

/** show_seasons.id for (show id, season number), or null. */
async function seasonIdFor(pool, showId, seasonNumber) {
  const { rows } = await pool.query("SELECT id FROM show_seasons WHERE show_id=$1 AND season_number=$2", [
    showId,
    seasonNumber,
  ]);
  return rows.length ? rows[0].id : null;
}

/**
 * The season's staged/approved cast as a minimal league-shaped state, so the same forgiving name
 * matching the rest of the app uses (StateLogic.Core.findCastawayByName) can resolve a source's
 * spelling to the season's own.
 */
async function seasonCastState(pool, seasonId) {
  const { rows } = await pool.query(
    "SELECT id, name, tribe_name FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC",
    [seasonId]
  );
  return {
    castaways: rows.map((r) => ({ id: r.id, name: r.name, tribeName: r.tribe_name, status: "active" })),
    tribes: [],
    episodes: [],
    settings: {},
  };
}

/** The season cast's spelling of a name, or the name as given when it doesn't resolve. */
function canonicalName(castState, name) {
  const { castaway } = StateLogic.Core.findCastawayByName(castState, name);
  return castaway ? castaway.name : name;
}

/**
 * Upserts one read's worth of decisions for a season.
 *
 *   items   -- [{ episode, postMerge, kind, name, method, eventType, confidence, sources }]
 *   source  -- "wiki" | "research"
 *   refId   -- the wiki_extractions / episode_research row they came from
 *   scope   -- { episode } limits the stale-row cleanup to one episode (research is per episode;
 *              a wiki read covers the whole season)
 *
 * Decided rows keep their decision: a re-read only moves PENDING rows, so it can never undo what an
 * admin already decided. It does still record that this source (also) reported the fact.
 *
 * A pending row this source proposed last time but not this time is withdrawn -- the source changed
 * its mind (a corrected wiki table, a re-research) and there's nothing left to review. A row the
 * other source also reported just loses this source's flag.
 */
async function stageDecisions(pool, seasonId, items, source, refId, scope = {}) {
  const fromWiki = source === "wiki";
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  let withdrawn = 0;
  const ids = [];
  try {
    await client.query("BEGIN");
    for (const it of items) {
      const { rows } = await client.query(
        // clock_timestamp(), not now(): every row in this transaction would otherwise share one
        // created_at, and created_at is the tiebreak that keeps a double elimination in the order
        // the source listed it.
        `INSERT INTO season_decisions
           (season_id, episode_number, post_merge, kind, castaway_name, method, event_type, confidence,
            from_wiki, from_research, extraction_id, research_id, sources, jury_votes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$15, clock_timestamp())
         ON CONFLICT (season_id, episode_number, kind, castaway_name, event_type)
         DO UPDATE SET
           from_wiki     = season_decisions.from_wiki OR EXCLUDED.from_wiki,
           from_research = season_decisions.from_research OR EXCLUDED.from_research,
           extraction_id = COALESCE(EXCLUDED.extraction_id, season_decisions.extraction_id),
           research_id   = COALESCE(EXCLUDED.research_id, season_decisions.research_id),
           sources       = CASE WHEN EXCLUDED.from_research THEN EXCLUDED.sources ELSE season_decisions.sources END,
           method        = CASE WHEN season_decisions.status = 'pending' THEN EXCLUDED.method ELSE season_decisions.method END,
           -- A finalist's jury count (0036): updated while pending; on a decision already made, only
           -- filled in when it had none (the wiki's elimination was accepted before research knew the
           -- count) -- syncLeagueDecisions then tops up the leagues' elimination with it.
           jury_votes    = CASE WHEN season_decisions.status = 'pending' THEN COALESCE(EXCLUDED.jury_votes, season_decisions.jury_votes)
                                ELSE COALESCE(season_decisions.jury_votes, EXCLUDED.jury_votes) END,
           -- Only the wiki knows merge status; research leaves whatever is there.
           post_merge    = CASE WHEN season_decisions.status = 'pending' AND EXCLUDED.from_wiki THEN EXCLUDED.post_merge ELSE season_decisions.post_merge END,
           confidence    = CASE WHEN season_decisions.status = 'pending'
                                 AND $14::int > (CASE season_decisions.confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)
                                THEN EXCLUDED.confidence ELSE season_decisions.confidence END
         RETURNING id, (xmax = 0) AS inserted`,
        [
          seasonId,
          it.episode,
          !!it.postMerge,
          it.kind,
          it.name,
          it.method || "",
          it.eventType || "",
          it.confidence || "high",
          fromWiki,
          !fromWiki,
          fromWiki ? refId || null : null,
          fromWiki ? null : refId || null,
          it.sources || [],
          CONFIDENCE_RANK[it.confidence] || 3,
          Number.isInteger(it.juryVotes) ? it.juryVotes : null,
        ]
      );
      ids.push(rows[0].id);
      if (rows[0].inserted) inserted++;
      else updated++;
    }

    const flag = fromWiki ? "from_wiki" : "from_research";
    const episodeFilter = scope.episode != null ? "AND episode_number = $3" : "";
    const params = scope.episode != null ? [seasonId, ids, scope.episode] : [seasonId, ids];
    await client.query(
      `UPDATE season_decisions SET ${flag} = false
        WHERE season_id=$1 AND status='pending' AND ${flag} AND NOT (id = ANY($2::uuid[])) ${episodeFilter}`,
      params
    );
    const { rowCount } = await client.query(
      "DELETE FROM season_decisions WHERE season_id=$1 AND status='pending' AND NOT from_wiki AND NOT from_research",
      [seasonId]
    );
    withdrawn = rowCount;
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return { inserted, updated, withdrawn };
}

module.exports = { seasonIdFor, seasonCastState, canonicalName, stageDecisions };
