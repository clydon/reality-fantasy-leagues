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

// The shape StateLogic.applyCastImport wants. Tribes are derived from whatever tribe names survive
// on the rows -- so an admin who cleared them (a catching-up league shouldn't see the starting
// division before the premiere) gets a cast with no tribes at all, rather than empty tribes.
function payloadFor(cast: SeasonCastRow[]) {
  const tribes: { name: string }[] = [];
  for (const c of cast) {
    if (c.tribeName && !tribes.some((t) => t.name.toLowerCase() === c.tribeName!.toLowerCase())) {
      tribes.push({ name: c.tribeName });
    }
  }
  return { tribes, castaways: cast.map((c) => ({ name: c.name, tribeName: c.tribeName, photoUrl: c.photoUrl })) };
}

/** Applies a season's approved cast into one already-locked league state. Returns what it added. */
export function applyCastToState(state: LeagueState, cast: SeasonCastRow[]) {
  return StateLogic.applyCastImport(state, payloadFor(cast));
}

/**
 * The approved cast for (show slug, season number), or null when that season has none yet. Used by
 * the league settings route: picking a season is the other moment a league should receive it.
 */
export async function approvedCastFor(
  client: PoolClient,
  showSlug: string | null | undefined,
  seasonNumber: number | null | undefined
): Promise<SeasonCastRow[] | null> {
  if (!showSlug || seasonNumber == null) return null;
  const { rows } = await client.query(
    `SELECT sc.id, sc.name, sc.tribe_name AS "tribeName", sc.photo_url AS "photoUrl"
       FROM season_cast sc
       JOIN show_seasons ss ON ss.id = sc.season_id
       JOIN shows s ON s.id = ss.show_id
      WHERE s.slug = $1 AND ss.season_number = $2 AND ss.cast_approved_at IS NOT NULL
      ORDER BY sc.sort_order ASC, sc.name ASC`,
    [showSlug, seasonNumber]
  );
  return rows.length ? rows : null;
}

/**
 * Pushes a season's approved cast into every league tracking it. One league failing (a lock
 * timeout, a league deleted mid-loop) is reported against that league and never denies the others,
 * same rule the connector's own fan-out follows.
 */
export async function applyApprovedCastToLeagues(
  showSlug: string,
  seasonNumber: number,
  cast: SeasonCastRow[]
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
      let added: { castaways: string[]; skipped: string[] } = { castaways: [], skipped: [] };
      await withLeagueLock(league.id, (state) => {
        added = applyCastToState(state, cast) as typeof added;
      });
      results.push({ leagueId: league.id, leagueName: league.name, added: added.castaways, skipped: added.skipped });
    } catch (e) {
      results.push({
        leagueId: league.id,
        leagueName: league.name,
        added: [],
        skipped: [],
        ...{ error: e instanceof Error ? e.message : "failed" },
      } as CastApplyResult);
    }
  }
  return results;
}
