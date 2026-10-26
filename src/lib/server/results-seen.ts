import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { followLeagueProgress } from "./follows";

// Spoiler protection's server half (db/migrations/0034): each member's "seen results through
// episode N" mark. The client trims anything later out of what it displays
// (StateLogic.SpoilerLogic) until they tap Reveal.

/** Whether this account has opted out (Account settings: show results as soon as they're in). */
export async function showsResultsImmediately(userId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT show_results_immediately FROM user_settings WHERE user_id=$1", [userId]);
  return !!rows[0]?.show_results_immediately;
}

/**
 * The member's mark, or null when they see everything (opted out, or not a member -- an admin
 * looking in). First load sets it to the latest episode that already has results, so switching
 * this feature on never hides what someone has already seen -- only what arrives afterwards.
 */
export async function resultsSeenThrough(userId: string, leagueId: string, state: LeagueState): Promise<number | null> {
  const { rows } = await pool.query("SELECT results_seen_through, player_id FROM league_memberships WHERE league_id=$1 AND user_id=$2", [
    leagueId,
    userId,
  ]);
  if (!rows.length) return null;
  // A late joiner (StateLogic.GhostLogic) always has a mark, whatever their account setting: "show
  // results immediately" would hand them the whole season they're catching up on. Until they've
  // chosen where to start, that's nothing at all.
  const late = StateLogic.GhostLogic.lateJoinOf(state, rows[0].player_id);
  if (late) return late.startEpisode === null ? 0 : rows[0].results_seen_through ?? late.startEpisode - 1;
  if (await showsResultsImmediately(userId)) return null;
  if (rows[0].results_seen_through !== null) return rows[0].results_seen_through;
  const latest = StateLogic.SpoilerLogic.latestWithResults(state);
  await pool.query("UPDATE league_memberships SET results_seen_through=$3 WHERE league_id=$1 AND user_id=$2", [leagueId, userId, latest]);
  // The new design's progress moves with every mark (follows.ts).
  await followLeagueProgress(userId, leagueId);
  return latest;
}

/** Revealed through episode n. Only ever moves forward: once seen, seen. */
export async function markResultsSeen(userId: string, leagueId: string, n: number): Promise<void> {
  await pool.query(
    `UPDATE league_memberships SET results_seen_through = GREATEST(COALESCE(results_seen_through, 0), $3)
      WHERE league_id=$1 AND user_id=$2`,
    [leagueId, userId, n]
  );
  await followLeagueProgress(userId, leagueId);
}

