import { after } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { sendPush, type NotificationType, type PushWords } from "./push-core";

// Game concepts -> the accounts behind them. Pushes go to USERS (their devices), while league state
// talks about PLAYERS; league_memberships is the bridge between the two. A player with no linked
// account (a seat the commissioner manages) simply has no one to notify.

export async function userIdsForPlayers(leagueId: string, playerIds: (string | null | undefined)[]): Promise<string[]> {
  const ids = playerIds.filter((p): p is string => !!p);
  if (!ids.length) return [];
  const { rows } = await pool.query(
    "SELECT user_id FROM league_memberships WHERE league_id=$1 AND player_id = ANY($2::text[])",
    [leagueId, ids]
  );
  return rows.map((r) => r.user_id);
}

/** Everyone in the league, optionally minus the person who caused the event. */
// Late joiners (StateLogic.GhostLogic) hear nothing the league broadcasts while they're catching up
// (any of it could be a spoiler), and nothing about the league's own goings-on while it can't see them
// (a ghost). opts.ghosts: include ghosts who have caught up -- episode results are theirs to hear too.
export async function leagueMemberUserIds(leagueId: string, except?: string | null, opts?: { ghosts?: boolean }): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT m.user_id, m.player_id, l.state FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.league_id=$1",
    [leagueId]
  );
  return rows
    .filter((r) => r.user_id !== except && !leftOutOfBroadcasts(r.state, r.player_id, !!opts?.ghosts))
    .map((r) => r.user_id);
}

/** Whether a broadcast skips this member (see leagueMemberUserIds). */
export function leftOutOfBroadcasts(state: LeagueState | null, playerId: string | null, ghostsIncluded = false): boolean {
  if (!state || !playerId) return false;
  if (StateLogic.GhostLogic.isCatchingUp(state, playerId)) return true;
  return !ghostsIncluded && StateLogic.GhostLogic.isGhost(StateLogic.getPlayer(state, playerId));
}

export async function leagueName(leagueId: string): Promise<string> {
  const { rows } = await pool.query("SELECT name FROM leagues WHERE id=$1", [leagueId]);
  return rows[0]?.name ?? "your league";
}

// Schedules a push to run after the response is sent, via Next's after() -- on Vercel a plain
// un-awaited promise can be frozen mid-flight once the function returns, silently dropping the
// push. Resolving recipients happens inside too, so none of that DB work delays the response.
//
// Call this only AFTER the triggering write has committed: after() callbacks run even when the
// request goes on to fail, and a push for a pick that was rolled back would be a lie.
//
// `message` may be worded per reader (push-core.js: the guard decides what each may be told, in their own time zone, opening
// the design they're on); `seasonId` is the season it's about, for that show's own switches and the bell's art.
export function notifyAfter(
  type: NotificationType,
  // `type`: the moment it turned out to be, when that's only known once resolved (final results before their time are early).
  resolve: () => Promise<{ userIds: string[]; message: PushWords; seasonId?: string | null; bell?: boolean; type?: NotificationType } | null>
): void {
  after(async () => {
    try {
      const target = await resolve();
      if (target && target.userIds.length) await sendPush(pool, target.userIds, target.type ?? type, target.message, { seasonId: target.seasonId ?? null, bell: target.bell });
    } catch (e) {
      console.error(`[push] ${type} notification failed:`, e);
    }
  });
}
