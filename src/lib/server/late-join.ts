import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool, HttpError } from "./db";
import { leftOutOfBroadcasts } from "./push-targets";

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
 * Linked leagues (league-groups.ts) share one reveal: revealing in one moves this person's mark in
 * every linked league they're in. Except where they're a late joiner still catching up -- there their
 * mark is their week, and only their own reveal there may move it. The linked leagues it must skip.
 */
export async function catchingUpIn(userId: string, leagueIds: string[]): Promise<Set<string>> {
  const { rows } = await pool.query(
    "SELECT l.id, l.state, m.player_id FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = $1 AND l.id = ANY($2::uuid[])",
    [userId, leagueIds]
  );
  return new Set(rows.filter((r) => StateLogic.GhostLogic.isCatchingUp(r.state, r.player_id)).map((r) => r.id as string));
}

/**
 * A linked league's chat is the whole group's. The people out of it: those who are a late joiner (a
 * ghost, or catching up) in every league of the group they're in. Someone who's a late joiner in one
 * linked league but an ordinary player in another is in the conversation through that other one.
 */
export async function outOfGroupChat(leagueIds: string[]): Promise<Set<string>> {
  const { rows } = await pool.query(
    "SELECT m.user_id, m.player_id, l.state FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.league_id = ANY($1::uuid[])",
    [leagueIds]
  );
  const inChat = new Set<string>();
  const all = new Set<string>();
  for (const r of rows) {
    all.add(r.user_id);
    if (!leftOutOfBroadcasts(r.state, r.player_id)) inChat.add(r.user_id);
  }
  return new Set([...all].filter((id) => !inChat.has(id)));
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
