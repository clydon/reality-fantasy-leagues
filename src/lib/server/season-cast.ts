import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool, withLeagueLock } from "./db";

// The admin-approved cast for a catalogued season (db/migrations/0011), and how it reaches leagues.
//
// A cast is a fact about the show, the same for every league playing the season, so it's reviewed
// once in Admin > Shows & Seasons rather than once per commissioner -- see the migration's comment
// for the two things that were wrong with the per-league version. This module is the one place that
// turns those rows into league state, shared by the two moments it can happen:
//
//   * an admin approves the season's cast -> every league already tracking it gets it now;
//   * a league picks that season later     -> it gets the approved cast on the spot.
//
// Applying is StateLogic.applyCastImport, which is additive and idempotent: it never renames,
// re-tribes or removes an existing castaway, so a league that already entered its cast by hand keeps
// exactly what it had and simply gains whoever was missing.

export interface SeasonCastRow {
  id: string;
  name: string;
  tribeName: string | null;
  photoUrl: string | null;
}

export interface CastApplyResult {
  leagueId: string;
  leagueName: string;
  added: string[];
  skipped: string[];
  /** Castaways linked to a starting tribe by this call (see tribesDue). */
  tribed?: string[];
  error?: string;
}

/**
 * Whether a league may see the season's starting tribes yet.
 *
 * `tribesFromEpisode` is the season's hold (db/migrations/0013): null means nothing is held back.
 * A league playing LIVE is never holding anything back either -- it sees results as the connector
 * reads them, so there's nothing to protect it from. Only a league catching up waits, until it has
 * revealed the episode that shows the division.
 */
export function tribesDue(state: LeagueState, tribesFromEpisode: number | null | undefined): boolean {
  if (tribesFromEpisode == null) return true;
  const revealed = StateLogic.RevealLogic.revealedThrough(state);
  return revealed === null || revealed >= tribesFromEpisode;
}

/** The season's staged/approved cast, in the order an admin arranged it. */
export async function seasonCastRows(seasonId: string): Promise<SeasonCastRow[]> {
  const { rows } = await pool.query(
    `SELECT id, name, tribe_name AS "tribeName", photo_url AS "photoUrl"
       FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC`,
    [seasonId]
  );
  return rows;
}

// The shape StateLogic.applyCastImport wants. `withTribes: false` strips the division entirely --
// no tribe list, no tribeName on anyone -- which is what a league that hasn't revealed the premiere
// gets. Empty tribes are never created: a tribe with nobody in it is a spoiler of its own (it names
// the division and how many there are) and clutter besides.
function payloadFor(cast: SeasonCastRow[], withTribes: boolean) {
  const tribes: { name: string }[] = [];
  if (withTribes) {
    for (const c of cast) {
      if (c.tribeName && !tribes.some((t) => t.name.toLowerCase() === c.tribeName!.toLowerCase())) {
        tribes.push({ name: c.tribeName });
      }
    }
  }
  return {
    tribes,
    castaways: cast.map((c) => ({ name: c.name, tribeName: withTribes ? c.tribeName : null, photoUrl: c.photoUrl })),
  };
}

/**
 * Applies a season's approved cast into one already-locked league state, including the starting
 * tribes only if this league is allowed to see them yet. Returns what it added.
 *
 * Two calls, not one, because they do different jobs: applyCastImport adds people who aren't there
 * (and skips everyone who is), while applyCastTribes links people who ARE there to a tribe. A
 * league receiving its cast for the first time uses the first; a league that already has the cast
 * and has just revealed the premiere uses the second. Running both always is simplest and costs
 * nothing -- each is additive and idempotent.
 */
export function applyCastToState(state: LeagueState, cast: SeasonCastRow[], tribesFromEpisode?: number | null) {
  const withTribes = tribesDue(state, tribesFromEpisode);
  const added = StateLogic.applyCastImport(state, payloadFor(cast, withTribes));
  const tribed = withTribes ? StateLogic.applyCastTribes(state, payloadFor(cast, true)) : null;
  return { ...added, tribed: tribed ? tribed.linked : [] };
}

/**
 * The approved cast for (show slug, season number), or null when that season has none yet. Used by
 * the league settings route: picking a season is the other moment a league should receive it.
 */
export async function approvedCastFor(
  client: PoolClient,
  showSlug: string | null | undefined,
  seasonNumber: number | null | undefined
): Promise<{ cast: SeasonCastRow[]; tribesFromEpisode: number | null } | null> {
  if (!showSlug || seasonNumber == null) return null;
  const { rows } = await client.query(
    `SELECT sc.id, sc.name, sc.tribe_name AS "tribeName", sc.photo_url AS "photoUrl",
            ss.tribes_from_episode AS "tribesFromEpisode"
       FROM season_cast sc
       JOIN show_seasons ss ON ss.id = sc.season_id
       JOIN shows s ON s.id = ss.show_id
      WHERE s.slug = $1 AND ss.season_number = $2 AND ss.cast_approved_at IS NOT NULL
      ORDER BY sc.sort_order ASC, sc.name ASC`,
    [showSlug, seasonNumber]
  );
  return rows.length ? { cast: rows, tribesFromEpisode: rows[0].tribesFromEpisode ?? null } : null;
}

/**
 * The approved cast for the season a league is tracking, whatever its reveal state -- used by the
 * reveal route, which has just moved the pointer and needs to know whether the starting tribes have
 * come due. Resolves to null when the league's season has no approved cast.
 */
export async function approvedCastForLeague(
  client: PoolClient,
  state: LeagueState
): Promise<{ cast: SeasonCastRow[]; tribesFromEpisode: number | null } | null> {
  return approvedCastFor(client, state.settings.showId, state.settings.wikiSeason);
}

/**
 * Pushes a season's approved cast into every league tracking it. One league failing (a lock
 * timeout, a league deleted mid-loop) is reported against that league and never denies the others,
 * same rule the connector's own fan-out follows.
 */
export async function applyApprovedCastToLeagues(
  showSlug: string,
  seasonNumber: number,
  cast: SeasonCastRow[],
  tribesFromEpisode: number | null
): Promise<CastApplyResult[]> {
  // Text comparison rather than ::int for the season: one league with a non-numeric value there
  // would otherwise make the cast error out for every league on the season.
  const { rows: leagues } = await pool.query(
    `SELECT id, name FROM leagues
      WHERE state->'settings'->>'showId' = $1
        AND state->'settings'->>'wikiSeason' = $2
      ORDER BY name`,
    [showSlug, String(seasonNumber)]
  );

  const results: CastApplyResult[] = [];
  for (const league of leagues) {
    try {
      let added: { castaways: string[]; skipped: string[]; tribed: string[] } = { castaways: [], skipped: [], tribed: [] };
      await withLeagueLock(league.id, (state) => {
        added = applyCastToState(state, cast, tribesFromEpisode);
      });
      results.push({
        leagueId: league.id,
        leagueName: league.name,
        added: added.castaways,
        skipped: added.skipped,
        tribed: added.tribed,
      });
    } catch (e) {
      results.push({
        leagueId: league.id,
        leagueName: league.name,
        added: [],
        skipped: [],
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }
  return results;
}
