import type { Pool, PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import * as Air from "@/lib/game/air-schedule.js";
import * as Spec from "@/lib/game/game-spec";
import { locksOf, type Closes } from "@/lib/sports/locks";

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
  const clear = () => state.episodes.forEach((ep) => {
    delete ep.airsAt;
    delete ep.locksAt;
  });
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null || StateLogic.RevealLogic.isCatchingUp(state)) return clear();
  const { rows } = await db.query(
    `SELECT ss.id AS season_id, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz,
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
  await stampSportLocks(db, state, rows[0].season_id as string);
}

/**
 * L4 part 1a: a sport's game whose spec closes daily or weekly (its sport's lock cadence, spec.ts specCloses) carries each
 * episode's lock (ep.locksAt: a league's slate's episode at its own first game, else its day's or week's first start among the
 * game's own episodes, from their games' starts, season_events.starts_at: src/lib/sports/locks.ts); any other league, and an episode with no linked game, none. Asks nothing of
 * the database otherwise.
 */
async function stampSportLocks(db: Pool | PoolClient, state: LeagueState, seasonId: string): Promise<void> {
  state.episodes.forEach((ep) => delete ep.locksAt);
  const closes = Spec.gameOf(state.settings).closes;
  if (closes !== "daily" && closes !== "weekly") return;
  const locks = await sportLocks(db, seasonId, closes, { from: StateLogic.startEpisode(state) ?? 1, to: StateLogic.endEpisode(state) });
  for (const ep of state.episodes) {
    const at = locks.get(ep.number);
    if (at) ep.locksAt = at;
  }
}

/**
 * Each episode's lock on a sport's season, by `closes`, from its linked games' starts; `span` the game's episodes (from, to: null
 * to the season's end), so a game that starts later never locks with a game before it. A league's slate (L8 part 3) locks each
 * episode at its own first game: the episode is the week.
 */
export async function sportLocks(db: Pool | PoolClient, seasonId: string, closes: Closes, span: { from: number; to: number | null } = { from: 1, to: null }): Promise<Map<number, string>> {
  const { rows } = await db.query(
    `SELECT episode, starts_at, EXISTS (SELECT 1 FROM sports_slates x WHERE x.season_id = $1) AS slate
       FROM season_events WHERE season_id = $1 AND episode >= $2 AND ($3::int IS NULL OR episode <= $3)`,
    [seasonId, span.from, span.to]
  );
  const starts = rows.map((r) => ({ episode: r.episode as number, at: r.starts_at ? (r.starts_at as Date).toISOString() : null }));
  return locksOf(starts, closes, { slate: rows[0]?.slate === true });
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
