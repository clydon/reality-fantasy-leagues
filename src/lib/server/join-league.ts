import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { asItStands } from "./answer-points";
import { leagueSeason, notifyMemberJoined } from "./push-events";
import { joinedLeague } from "./couches";
import { followLeagueProgress } from "./follows";
import { EVERYTHING, seenThrough } from "./guard";
import { shareCheck } from "./shared-seats";

export interface JoinLeagueResult {
  league: { id: string; name: string };
  // True when the user's own previously-disabled seat was restored instead of a new player
  // being created -- lets the client say "Welcome back" rather than a generic "You joined!".
  reclaimed: boolean;
  // A10 part 4b: true when they joined someone's team to share it (an invite to a seat in a game that shares them).
  shared?: boolean;
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
//
// An invite to a seat someone already holds, in a game that shares its seats (step A10 part 4b of
// docs/PLAN-start-a-game-gpt.md: shared-seats.ts), joins them to that team: the seat keeps its name, team and history, and
// they take its next seat_slot. Their spoiler mark starts where they are on the season, never past the latest results (as
// joining a game that's under way does: couch-joins.ts). An invite that can't share any more (the team's full, the game
// stopped sharing, the seat is catching up) lets them in as a new player, as a hand-over invite whose seat was taken does.
export async function joinLeague(
  leagueId: string,
  user: SessionUser,
  afterJoin?: (client: PoolClient) => Promise<void>,
  seatPlayerId?: string | null
): Promise<JoinLeagueResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT id, name, state, solo FROM leagues WHERE id=$1 FOR UPDATE", [leagueId]);
    if (!rows.length) throw new HttpError(404, "League not found");
    const league = rows[0];
    // A public pool is joined from its show's Games tab, a practice couch is its maker's alone (solo.ts).
    if (league.solo) throw new HttpError(403, league.solo === "public" ? "Join this pool from its show's Games tab" : "That's someone's practice couch");

    const existing = await client.query("SELECT id FROM league_memberships WHERE league_id=$1 AND user_id=$2", [league.id, user.id]);
    if (existing.rows.length) throw new HttpError(409, "You're already in that league");

    const state: LeagueState = league.state;
    const disabledOwn = state.players.find((p) => p.disabled && p.disabledFromUserId === user.id);
    const seat = seatPlayerId ? await takeableSeat(client, league.id, state, seatPlayerId) : null;
    // An invite to share a team wins over their own old seat, as one that hands a seat over does (it stays disabled).
    const share = seatPlayerId && !seat ? await shareCheck(client, league.id, state, seatPlayerId) : null;
    if (seatPlayerId && share && "slot" in share) {
      // Sharing someone's team: nothing in the game changes but who can act for it. "How this league works" opens once for them.
      const { seasonId } = await leagueSeason(league.id);
      const latest = StateLogic.SpoilerLogic.latestWithResults(state);
      const mark = seasonId ? await seenThrough(user.id, seasonId, client) : 0;
      await client.query(
        "INSERT INTO league_memberships (league_id, user_id, player_id, role, seat_slot, results_seen_through, explainer_seen_at) VALUES ($1, $2, $3, 'member', $4, $5, NULL)",
        [league.id, user.id, seatPlayerId, share.slot, mark === EVERYTHING ? latest : Math.min(latest, mark)]
      );
      if (afterJoin) await afterJoin(client);
      await client.query("COMMIT");
      await joinedLeague(league.id, user.id);
      await followLeagueProgress(user.id, league.id);
      notifyMemberJoined(league.id, user.id, (user as { username?: string | null }).username || user.name, false);
      return { league: { id: league.id, name: league.name }, reclaimed: false, shared: true };
    }
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
      // Step A11 part 5c of docs/PLAN-start-a-game-gpt.md: nobody new plays once someone's out, a game of questions read as it stands
      // (its walk isn't in its state): the seat waits, inactive, as one joining after a finished draft does.
      const someoneOut = StateLogic.GhostLogic.someoneOut((await asItStands(league.id, state)).state);
      playerId = StateLogic.addPlayer(state, (user as { username?: string | null }).username || user.name, { someoneOut }).id;
    }

    await client.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), league.id]);
    // "How this league works" opens once for someone new to it; reclaiming your own old seat isn't.
    await client.query(
      "INSERT INTO league_memberships (league_id, user_id, player_id, role, explainer_seen_at) VALUES ($1,$2,$3,'member',$4)",
      [league.id, user.id, playerId, disabledOwn ? new Date() : null]
    );
    if (afterJoin) await afterJoin(client);
    await client.query("COMMIT");
    // On the league's couch, and following its season (couches.ts, follows.ts): after the commit, so neither
    // can cost the join.
    await joinedLeague(league.id, user.id);
    await followLeagueProgress(user.id, league.id);
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
