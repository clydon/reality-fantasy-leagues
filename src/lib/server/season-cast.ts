import type { Pool, PoolClient } from "pg";
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
// Each league castaway is linked to the season_cast row it is (castaway.seasonCastId, docs/PLAN-
// universal-season-cast.md), and from then on the season cast finds them by that link rather than by
// name. So applying a cast does two different things to two different groups:
//
//   * linked castaways are brought in line with their row -- an admin's rename, new photo or
//     starting-tribe fix reaches every league in place (StateLogic.syncSeasonCast);
//   * everyone else is left exactly as they were, and anyone the league doesn't have yet is added
//     (StateLogic.applyCastImport, additive and idempotent), born linked.
//
// Linking here is by exact name only -- the same test applyCastImport has always used for "this
// person is already here". Anything looser goes through db/link-season-cast.js's reviewed dry run.

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
  /** Castaways newly linked to their season_cast row by exact name. */
  linked?: string[];
  /** What bringing linked castaways in line with the season cast changed. */
  synced?: ReturnType<typeof StateLogic.syncSeasonCast>;
  /** Season rows NOT added because an unlinked castaway here might already be them (see applyCastToState). */
  needsReview?: string[];
  /** Castaways taken out because their season row was removed while the cast was being created. */
  removed?: string[];
  error?: string;
}

/**
 * Whether a league may see the season's starting tribes yet.
 *
 * `tribesFromEpisode` is the season's hold (db/migrations/0013): null means nothing is held back.
 * Otherwise the tribes wait until the league has REACHED that episode:
 *
 *   catching up -- it has revealed that episode (the reveal pointer is at or past it);
 *   live        -- it has results logged for that episode or a later one (an elimination, a scoring
 *                  event, or an exile on it).
 *
 * The live case used to return true unconditionally, on the reasoning that a live league has nothing
 * to be protected from. That was wrong: an admin who holds the tribes means "don't show the division
 * before the premiere's results do", and a live league created before the premiere airs -- the normal
 * case -- was being handed the tribes the moment the cast was approved.
 */
export function tribesDue(state: LeagueState, tribesFromEpisode: number | null | undefined): boolean {
  // The rule itself lives in StateLogic so db/link-season-cast.js (bare node) reads the same one.
  return StateLogic.castTribesDue(state, tribesFromEpisode);
}

/**
 * Hands a league its held starting tribes if they've just come due -- called inside the league lock
 * by every route that records an episode's results (applying accepted season decisions, logging an
 * elimination or scoring event by hand, revealing an episode), since any of them can be the moment a
 * league reaches the held episode. Additive and idempotent: a castaway who already has a tribe keeps
 * it, so calling this on every result write is harmless. Returns the names newly linked.
 */
export async function applyHeldTribesIfDue(client: PoolClient, state: LeagueState): Promise<string[]> {
  const approved = await approvedCastForLeague(client, state);
  if (!approved || approved.tribesFromEpisode == null) return [];
  if (!tribesDue(state, approved.tribesFromEpisode)) return [];
  return StateLogic.applyCastTribes(state, {
    castaways: approved.cast.map((c) => ({ id: c.id, name: c.name, tribeName: c.tribeName })),
  }).linked;
}

/**
 * Carries a season cast rename into the season's staged results (docs/PLAN-universal-season-cast.md,
 * piece 7). A result is staged under the season cast's spelling of the moment; renaming someone would
 * otherwise leave their results under the old name, matched only by the loose fallback. Both the
 * proposed name and an admin's correction (`applied.castawayName`) follow. Nothing else moves:
 * syncLeagueDecisions keys on decided_at, so a renamed result isn't re-applied or undone anywhere.
 */
export async function renameInSeasonDecisions(db: Pool | PoolClient, seasonId: string, from: string, to: string) {
  await db.query(
    "UPDATE season_decisions SET castaway_name=$3 WHERE season_id=$1 AND lower(castaway_name)=lower($2)",
    [seasonId, from, to]
  );
  await db.query(
    `UPDATE season_decisions SET applied = jsonb_set(applied, '{castawayName}', to_jsonb($3::text))
      WHERE season_id=$1 AND lower(applied->>'castawayName')=lower($2)`,
    [seasonId, from, to]
  );
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

/**
 * Applies a season's approved cast into one already-locked league state, including the starting
 * tribes only if this league is allowed to see them yet. Returns what it changed.
 *
 * The steps -- link exact names, bring linked castaways in line, add who's missing (holding back any
 * possible duplicate of an unlinked castaway as `needsReview`), then starting tribes -- are
 * StateLogic.applySeasonCast, shared with db/link-season-cast.js's preview so the two can't drift.
 */
export function applyCastToState(state: LeagueState, cast: SeasonCastRow[], tribesFromEpisode?: number | null) {
  return StateLogic.applySeasonCast(state, cast, { withTribes: tribesDue(state, tribesFromEpisode) });
}

/**
 * Takes out castaways whose season_cast row was removed, but only someone nothing refers to yet (no
 * owner, no result, no pick or lineup -- StateLogic.castawayInUse). A row can only be removed while
 * its cast is still being created, before any league on the season is underway, so in practice this
 * always succeeds; the check is there so it can never strand a drafted pick. Returns the names removed.
 */
export function removeUnlinkedRows(state: LeagueState, removedSeasonCastIds: string[]): string[] {
  const gone: string[] = [];
  for (const id of removedSeasonCastIds) {
    const c = state.castaways.find((x) => x.seasonCastId === id);
    if (!c || StateLogic.castawayInUse(state, c.id)) continue;
    StateLogic.removeCastaway(state, c.id);
    gone.push(c.name);
  }
  return gone;
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
 * same rule syncSeasonLeagues follows.
 *
 * `exceptLeagueId` skips the league a commissioner's write already updated inside its own lock
 * (season-cast-write.ts); `removed` is season_cast rows deleted by that write, taken out of each league.
 */
export async function applyApprovedCastToLeagues(
  showSlug: string,
  seasonNumber: number,
  cast: SeasonCastRow[],
  tribesFromEpisode: number | null,
  opts: { exceptLeagueId?: string; removed?: string[] } = {}
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
    if (league.id === opts.exceptLeagueId) continue;
    try {
      let added: ReturnType<typeof applyCastToState> | null = null;
      let removed: string[] = [];
      await withLeagueLock(league.id, (state) => {
        if (opts.removed?.length) removed = removeUnlinkedRows(state, opts.removed);
        added = applyCastToState(state, cast, tribesFromEpisode);
      });
      const done = added as ReturnType<typeof applyCastToState> | null;
      results.push({
        leagueId: league.id,
        leagueName: league.name,
        added: done?.castaways ?? [],
        skipped: done?.skipped ?? [],
        tribed: done?.tribed ?? [],
        linked: done?.linked ?? [],
        synced: done?.synced,
        needsReview: done?.needsReview ?? [],
        removed,
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
