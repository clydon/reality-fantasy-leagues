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
  // Step A11 part 4: head to head's playoffs at the season's end read its length (stampSeasonLength, below).
  await stampSeasonLength(db, state);
  const clear = () => state.episodes.forEach((ep) => delete ep.airsAt);
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null || StateLogic.RevealLogic.isCatchingUp(state)) return clear();
  const { rows } = await db.query(
    `SELECT to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz,
            sad.air_dates AS wiki_air_dates
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       -- The wiki's dates with research-confirmed starts over them (0067): a week off moves the locks too.
       LEFT JOIN season_air_dates sad ON sad.season_id = ss.id
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

/**
 * Step A11 part 4: a head-to-head game whose playoffs sit at the season's end (StateLogic.MatchupLogic.readsSeasonLength) carries the
 * season's length as its schedule says it (state.seasonEpisodes, show_seasons.episode_count: public, not a spoiler, so a league
 * catching up gets it too), for the engine to place them (MatchupLogic.playoffsFrom); any other league carries none. Stamped with
 * the air times, and again after a write's mutation (db.ts withLeagueLock), so a write that turns head to head on saves it.
 */
export async function stampSeasonLength(db: Pool | PoolClient, state: LeagueState): Promise<void> {
  const { showId, wikiSeason } = state.settings;
  if (!StateLogic.MatchupLogic.readsSeasonLength(state) || !showId || wikiSeason == null) {
    delete state.seasonEpisodes;
    return;
  }
  const { rows } = await db.query(
    "SELECT ss.episode_count FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2",
    [showId, wikiSeason]
  );
  const n = rows[0]?.episode_count;
  if (Number.isInteger(n) && n > 0) state.seasonEpisodes = n;
  else delete state.seasonEpisodes;
}
