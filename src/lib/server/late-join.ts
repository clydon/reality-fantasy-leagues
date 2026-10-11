import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool, HttpError } from "./db";

// Late joiners' server half (StateLogic.GhostLogic, docs/PLAN-late-joiners.md).

/**
 * When this player is a late joiner still catching up, their spoiler mark: the episode their week
 * comes after. Null for everyone else, whose moves follow the league's ordinary rules.
 */
export async function catchingUpMark(leagueId: string, state: LeagueState, playerId: string | null | undefined): Promise<number | null> {
  if (!playerId || !StateLogic.GhostLogic.isCatchingUp(state, playerId)) return null;
  const late = StateLogic.GhostLogic.lateJoinOf(state, playerId);
  if (!late || late.startEpisode === null) throw new HttpError(400, "Choose where to start first");
  const { rows } = await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id=$1 AND player_id=$2", [
    leagueId,
    playerId,
  ]);
  return rows[0]?.results_seen_through ?? late.startEpisode - 1;
}

/** For the moves a late joiner sits out until they've caught up (side bets, finale predictions). */
export function refuseWhileCatchingUp(state: LeagueState, playerId: string | null | undefined, what: string) {
  if (playerId && StateLogic.GhostLogic.isCatchingUp(state, playerId)) {
    throw new HttpError(403, `${what} open once you've caught up`);
  }
}

/**
 * Chat is the league's conversation: a ghost can't be part of it while the league can't see them, and
 * a late joiner catching up would be reading spoilers. True when this member is out of it.
 */
export async function outOfChat(leagueId: string, playerId: string | null | undefined): Promise<boolean> {
  if (!playerId) return false;
  const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  const state = rows[0]?.state as LeagueState | undefined;
  if (!state) return false;
  return StateLogic.GhostLogic.isCatchingUp(state, playerId) || StateLogic.GhostLogic.isGhost(StateLogic.getPlayer(state, playerId));
}
