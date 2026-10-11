import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { notifyMemberJoined } from "./push-events";

export interface JoinLeagueResult {
  league: { id: string; name: string };
  // True when the user's own previously-disabled seat was restored instead of a new player
  // being created -- lets the client say "Welcome back" rather than a generic "You joined!".
  reclaimed: boolean;
}

// A seat an invite can hand over: still there, not disabled, and nobody's account on it yet. If it
// isn't any more (removed, or someone else took it), the invite still lets them in, as a new player.
async function takeableSeat(client: PoolClient, leagueId: string, state: LeagueState, playerId: string) {
  const seat = state.players.find((p) => p.id === playerId && !p.disabled);
  if (!seat) return null;
  const linked = await client.query("SELECT 1 FROM league_memberships WHERE league_id=$1 AND player_id=$2", [leagueId, playerId]);
  return linked.rows.length ? null : seat;
}

// The one "add this user to this league" path, shared by join-by-code (POST /api/leagues/join)
// and accept-invite (POST /api/invites/[id]/accept). Runs as a single transaction with the
// league row locked (same idea as withLeagueLock) so the state write and the membership insert
// land together. If the user left this league (or was disabled) earlier, their old seat is
// reclaimed -- matched by account id (disabledFromUserId), never by name. `afterJoin` runs
// inside the same transaction, e.g. to mark an invite accepted atomically with the join.
export async function joinLeague(
  leagueId: string,
  user: SessionUser,
  afterJoin?: (client: PoolClient) => Promise<void>,
  seatPlayerId?: string | null
): Promise<JoinLeagueResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT id, name, state FROM leagues WHERE id=$1 FOR UPDATE", [leagueId]);
    if (!rows.length) throw new HttpError(404, "League not found");
    const league = rows[0];

    const existing = await client.query("SELECT id FROM league_memberships WHERE league_id=$1 AND user_id=$2", [league.id, user.id]);
    if (existing.rows.length) throw new HttpError(409, "You're already in that league");

    const state: LeagueState = league.state;
    const disabledOwn = state.players.find((p) => p.disabled && p.disabledFromUserId === user.id);
    const seat = seatPlayerId ? await takeableSeat(client, league.id, state, seatPlayerId) : null;
    let playerId: string;
    if (seat) {
      // Taking over a seat (an invite that hands one over): they become that player, team, points and
      // history included, under their own name. A computer player stops playing it.
      seat.name = (user as { username?: string | null }).username || user.name;
      delete seat.automated;
      playerId = seat.id;
    } else if (disabledOwn) {
      StateLogic.reclaimPlayer(state, disabledOwn.id);
      playerId = disabledOwn.id;
    } else {
      playerId = StateLogic.addPlayer(state, (user as { username?: string | null }).username || user.name).id;
    }

    await client.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), league.id]);
    await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1,$2,$3,'member')", [
      league.id,
      user.id,
      playerId,
    ]);
    if (afterJoin) await afterJoin(client);
    await client.query("COMMIT");
    // After the commit, per notifyAfter's rule. Named as the league shows them (their player).
    const joinedAs = state.players.find((p) => p.id === playerId)?.name || (user as { username?: string | null }).username || user.name;
    // A late joiner (StateLogic.GhostLogic) is out of the league's sight: nobody hears they joined. Their
    // commissioners hear once they've chosen where to start (the late-join route).
    if (!StateLogic.GhostLogic.isGhost(state.players.find((p) => p.id === playerId))) {
      notifyMemberJoined(league.id, user.id, joinedAs, !!disabledOwn);
    }
    return { league: { id: league.id, name: league.name }, reclaimed: !!disabledOwn };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
