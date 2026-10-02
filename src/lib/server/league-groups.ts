import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";

// Linked leagues (db/migrations/0040): the leagues sharing a group share one chat and one reveal.
// Everything that reads "this league's chat" or "this league's members" goes through here, so an
// unlinked league is just a group of one.

/** This league and every league linked to it (just itself when it isn't linked). */
export async function groupLeagueIds(leagueId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT id FROM leagues WHERE id = $1
     UNION SELECT l2.id FROM leagues l1 JOIN leagues l2 ON l2.group_id = l1.group_id WHERE l1.id = $1 AND l1.group_id IS NOT NULL`,
    [leagueId]
  );
  return rows.map((r) => r.id as string);
}

/** Everyone in any linked league (the shared chat's audience), optionally minus one. */
export async function groupMemberUserIds(leagueId: string, except?: string | null): Promise<string[]> {
  const ids = await groupLeagueIds(leagueId);
  const { rows } = await pool.query("SELECT DISTINCT user_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [ids]);
  return rows.map((r) => r.user_id as string).filter((id) => id !== except);
}

/**
 * Why two leagues can't share a chat and a reveal, or null if they can: they must be on the same
 * show and season, and reveal in step -- both live, or both catching up at the same episode.
 * Otherwise one league's talk and reveals would spoil the other.
 */
export function linkProblem(a: LeagueState, b: LeagueState): string | null {
  if (!a.settings.showId || a.settings.wikiSeason == null) return "Pick this league's show and season first.";
  if (a.settings.showId !== b.settings.showId || a.settings.wikiSeason !== b.settings.wikiSeason) {
    return "Only leagues playing the same season can be linked.";
  }
  const ra = StateLogic.RevealLogic.revealedThrough(a);
  const rb = StateLogic.RevealLogic.revealedThrough(b);
  if (ra !== rb) {
    return ra === null || rb === null
      ? "A league that's catching up can't be linked with one that isn't — its chat would spoil the episodes it hasn't revealed."
      : "Both leagues need to have revealed the same episode first.";
  }
  return null;
}
