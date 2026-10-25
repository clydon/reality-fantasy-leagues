import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool, HttpError, withLeagueLock } from "./db";
import { groupLeagueIds, groupOrder } from "./league-groups";
import { leagueState, leagueStates } from "./league-states";
import { markResultsSeen, resultsSeenThrough } from "./results-seen";
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
 * Linked leagues (league-groups.ts) share one reveal, and a late joiner's leagues in one group share
 * one catch-up (docs/PLAN-linked-late-join.md): how far someone has watched is a fact about them and
 * the season, not about a league. After this person's reveal in `fromLeagueId` moved their mark from
 * `prev` to `n`, the same reveal in every other linked league they're in:
 *   - where they're catching up: only if that league was at the same mark (in step) -- one episode at
 *     a time, or to its latest on a jump. A league they're catching up in at a different mark keeps
 *     its own, so a reveal elsewhere can never carry them past the week they've watched.
 *   - where they haven't chosen a start yet: nothing (the late-join step asks them).
 *   - anywhere else: forward to n, as linked leagues always have.
 */
export async function revealAcrossGroup(userId: string, fromLeagueId: string, prev: number | null, n: number, jump: boolean) {
  const ids = (await groupLeagueIds(fromLeagueId)).filter((id) => id !== fromLeagueId);
  if (!ids.length) return;
  const { rows } = await pool.query(
    "SELECT l.id, l.state, m.player_id, m.results_seen_through FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = $1 AND l.id = ANY($2::uuid[])",
    [userId, ids]
  );
  for (const r of rows) {
    const id = r.id as string;
    const playerId = r.player_id as string | null;
    const late = playerId ? StateLogic.GhostLogic.lateJoinOf(r.state, playerId) : null;
    if (late && late.startEpisode === null) continue;
    if (!late || !late.catchingUp || !playerId) {
      await markResultsSeen(userId, id, n);
      continue;
    }
    const seen: number = r.results_seen_through ?? (late.startEpisode as number) - 1;
    if (prev === null || seen !== prev) continue;
    const latest = StateLogic.SpoilerLogic.latestWithResults(r.state);
    const to = jump ? latest : Math.min(n, latest);
    if (to <= seen) continue;
    await markResultsSeen(userId, id, to);
    await withLeagueLock(id, (s) => {
      StateLogic.GhostLogic.markCaughtUp(s, playerId, to);
      const lj = StateLogic.GhostLogic.lateJoinOf(s, playerId);
      if (lj) lj.seenThrough = to;
    });
  }
}

export interface LateJoinGroupLeague {
  id: string;
  name: string;
  /** Still to choose where they start (and draft). */
  pending: boolean;
  /** Where they've watched to here, once they're playing it: the answer the step reuses. */
  mark: number | null;
}

/**
 * The late-join step's group: every linked league this person is in, in the group's order. One
 * "Which episodes have you watched?" answer covers all the pending ones.
 */
export async function lateJoinGroup(userId: string, leagueId: string): Promise<LateJoinGroupLeague[]> {
  const { ids } = await groupOrder(leagueId);
  const { rows } = await pool.query(
    "SELECT l.id, l.name, l.state, m.player_id FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = $1 AND l.id = ANY($2::uuid[])",
    [userId, ids]
  );
  const out: LateJoinGroupLeague[] = [];
  for (const id of ids) {
    const r = rows.find((x) => x.id === id);
    if (!r) continue;
    const pending = !!r.player_id && StateLogic.GhostLogic.needsStart(r.state, r.player_id);
    const seen = pending ? null : await resultsSeenThrough(userId, id, r.state);
    const mark = pending ? null : (seen ?? StateLogic.SpoilerLogic.latestWithResults(r.state));
    out.push({ id, name: r.name, pending, mark });
  }
  return out;
}

/**
 * A linked league's chat is the whole group's. The people out of it: those who are a late joiner (a
 * ghost, or catching up) in every league of the group they're in. Someone who's a late joiner in one
 * linked league but an ordinary player in another is in the conversation through that other one.
 */
export async function outOfGroupChat(leagueIds: string[]): Promise<Set<string>> {
  // Each league's state once (league-states.ts), not once per member: the chat polls run this.
  const { rows } = await pool.query("SELECT user_id, player_id, league_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [
    leagueIds,
  ]);
  const states = await leagueStates(leagueIds);
  const inChat = new Set<string>();
  const all = new Set<string>();
  for (const r of rows) {
    const state = states.get(r.league_id);
    if (!state) continue;
    all.add(r.user_id);
    if (!leftOutOfBroadcasts(state, r.player_id)) inChat.add(r.user_id);
  }
  return new Set([...all].filter((id) => !inChat.has(id)));
}

/**
 * The new design's couch chat (step 9): the people a season's games can't see, a ghost in every one of them they're in.
 * Someone catching up whom the games can see is in the talk: the couch chat folds what others said past where they are
 * (chat-fold.ts), so it's spoiler-safe for them, which classic's league chat isn't (outOfGroupChat).
 */
export async function hiddenFromGroup(leagueIds: string[]): Promise<Set<string>> {
  const { rows } = await pool.query("SELECT user_id, player_id, league_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [leagueIds]);
  const states = await leagueStates(leagueIds);
  const seen = new Set<string>();
  const all = new Set<string>();
  for (const r of rows) {
    const state = states.get(r.league_id);
    if (!state) continue;
    all.add(r.user_id);
    if (!StateLogic.GhostLogic.isGhost(StateLogic.getPlayer(state, r.player_id))) seen.add(r.user_id);
  }
  return new Set([...all].filter((id) => !seen.has(id)));
}

/**
 * Chat is the league's conversation: a ghost can't be part of it while the league can't see them, and
 * a late joiner catching up would be reading spoilers. True when this member is out of it.
 */
export async function outOfChat(leagueId: string, playerId: string | null | undefined): Promise<boolean> {
  if (!playerId) return false;
  const state = await leagueState(leagueId);
  if (!state) return false;
  return StateLogic.GhostLogic.isCatchingUp(state, playerId) || StateLogic.GhostLogic.isGhost(StateLogic.getPlayer(state, playerId));
}
