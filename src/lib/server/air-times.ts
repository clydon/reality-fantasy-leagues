import type { Pool, PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import * as Air from "@/lib/game/air-schedule.js";

// Stamps each episode with when it airs (ep.airsAt), from the league's season schedule in the
// catalog (show_seasons' premiere/air time/zone, overridden by the wiki's own per-episode dates --
// the same clock auto-research and reminders run on). Lineups and Eliminator Pool picks lock at that
// moment (StateLogic.ActiveRosterLogic.isLineupLocked / PickEmLogic.setPick), so it's stamped both
// on every write (withLeagueLock, before the mutation is validated) and on every read.
//
// A catching-up league is left unstamped: it plays at its own pace, so the broadcast's clock means
// nothing to it -- its episodes lock when their results are revealed. So is a league whose season
// isn't in the catalog or has no schedule.
export async function stampAirTimes(db: Pool | PoolClient, state: LeagueState): Promise<void> {
  const clear = () => state.episodes.forEach((ep) => delete ep.airsAt);
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null || StateLogic.RevealLogic.isCatchingUp(state)) return clear();
  const { rows } = await db.query(
    `SELECT to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz,
            (SELECT json_object_agg(e->>'number', e->>'airDate')
               FROM wiki_extractions we, jsonb_array_elements(we.payload->'episodes') e
              WHERE we.show_id = s.id AND we.season_number = ss.season_number AND we.kind = 'episodes'
                AND e->>'airDate' IS NOT NULL) AS wiki_air_dates
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.slug = $1 AND ss.season_number = $2`,
    [showId, wikiSeason]
  );
  if (!rows.length) return clear();
  const season = { premiereDate: rows[0].premiere_date, airTime: rows[0].air_time, airTz: rows[0].air_tz };
  const wikiAirDates = rows[0].wiki_air_dates || {};
  for (const ep of state.episodes) {
    const at = Air.episodeAirTime(season, ep.number, wikiAirDates);
    if (at) ep.airsAt = at.toISOString();
    else delete ep.airsAt;
  }
}
