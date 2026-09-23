import type { PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { pool } from "./db";

// The server half of blind draft. Everything that touches blind_draft_picks lives here so there's
// exactly one file to audit for the privacy property the whole mechanic rests on: a player's
// submitted picks must not be observable by anyone else until the simultaneous reveal.
//
// Why a table rather than a key in `state` (the full reasoning is in
// db/migrations/0004_blind_draft_picks.sql): `state` is returned wholesale by GET .../state and by
// every mutation route, so anything inside it is readable from any member's Network tab. Keeping
// the picks out of `state` makes that leak structurally impossible instead of depending on ~40
// routes each remembering to redact -- and it means a route added later by someone who's never
// heard of blind draft cannot accidentally start leaking them.
//
// Read access is self-only, INCLUDING for the commissioner (impersonation aside) -- see readOwnPicks.

export interface BlindDraftLockResult {
  /** Rewritten from the table inside the transaction; mirrored into state.blindDraft. */
  lockedPlayerIds: string[];
  /** True when this call was the one that completed the set and triggered the reveal. */
  revealed: boolean;
}

async function lockedIdsFor(client: PoolClient, leagueId: string): Promise<string[]> {
  const { rows } = await client.query(
    "SELECT player_id FROM blind_draft_picks WHERE league_id=$1 ORDER BY locked_at, player_id",
    [leagueId]
  );
  return rows.map((r) => r.player_id as string);
}

// Stores one player's submission, republishes the public "who's locked in" mirror, and -- if that
// completed the set -- performs the reveal in the same transaction.
//
// Atomicity matters here and is the reason this takes the transaction's client rather than using
// the pool: withLeagueLock holds `SELECT ... FOR UPDATE` on the league row for the whole callback,
// so the insert, the "is everyone in now?" read, and the reveal write all happen under that lock.
// Two players locking in at the same instant therefore serialize -- exactly one of them observes
// the full set and performs the reveal, instead of both seeing "still waiting" (draft never
// reveals) or both revealing (ownership applied twice).
export async function lockBlindPicks(
  client: PoolClient,
  leagueId: string,
  state: LeagueState,
  playerId: string,
  castawayIds: string[]
): Promise<BlindDraftLockResult> {
  await client.query(
    `INSERT INTO blind_draft_picks (league_id, player_id, castaway_ids)
     VALUES ($1,$2,$3::jsonb)
     ON CONFLICT (league_id, player_id) DO UPDATE SET castaway_ids=EXCLUDED.castaway_ids, locked_at=now()`,
    [leagueId, playerId, JSON.stringify(castawayIds)]
  );

  const lockedPlayerIds = await lockedIdsFor(client, leagueId);
  StateLogic.BlindDraftLogic.setLockedPlayerIds(state, lockedPlayerIds);

  if (!StateLogic.BlindDraftLogic.allLockedIn(state, lockedPlayerIds)) {
    return { lockedPlayerIds, revealed: false };
  }

  // Everyone's in: read every submission and apply them all at once.
  const { rows } = await client.query(
    "SELECT player_id, castaway_ids FROM blind_draft_picks WHERE league_id=$1",
    [leagueId]
  );
  const picksByPlayer: Record<string, string[]> = {};
  for (const row of rows) picksByPlayer[row.player_id] = row.castaway_ids as string[];
  StateLogic.BlindDraftLogic.reveal(state, picksByPlayer);

  // Ownership now lives in state.castaways[].ownerIds, which is the durable record -- keeping a
  // second copy of the same facts here would only add a stale-data and privacy surface.
  await client.query("DELETE FROM blind_draft_picks WHERE league_id=$1", [leagueId]);
  StateLogic.BlindDraftLogic.setLockedPlayerIds(state, []);
  return { lockedPlayerIds: [], revealed: true };
}

// Withdraws a not-yet-revealed submission so the player can redo it. Safe by construction: if this
// player were the last one needed, the reveal would already have fired inside their own lock
// transaction, so there is no window in which someone can unlock to block a reveal that was
// otherwise about to happen.
export async function unlockBlindPicks(
  client: PoolClient,
  leagueId: string,
  state: LeagueState,
  playerId: string
): Promise<string[]> {
  await client.query("DELETE FROM blind_draft_picks WHERE league_id=$1 AND player_id=$2", [leagueId, playerId]);
  const lockedPlayerIds = await lockedIdsFor(client, leagueId);
  StateLogic.BlindDraftLogic.setLockedPlayerIds(state, lockedPlayerIds);
  return lockedPlayerIds;
}

// A player's own submitted picks, so their client can still show them after a page refresh.
//
// Self-only ON PURPOSE, and NOT commissioner-readable, which is the one place blind draft breaks
// this app's usual "commissioner can do anything on anyone's behalf" rule: the commissioner is
// normally also a player, so letting them read everyone's picks pre-reveal would hand one player
// perfect information and defeat the entire mechanic. The route enforces the same restriction; this
// function takes only the id whose picks are wanted and is never called with anyone else's.
//
// (The commissioner CAN still submit on a player's behalf -- someone has to be able to unblock a
// draft stalled on an absent player -- and unavoidably knows what they submitted in that case. That
// asymmetry is deliberate: submitting for someone is a visible, requested act, whereas reading
// their picks is silent.)
//
// A super-admin IMPERSONATING a player does see that player's picks, and that's expected rather than
// a hole in the above: impersonation makes you that user for every request (Better Auth's admin
// plugin swaps the session, so requireLeagueRole resolves their membership.playerId), which is the
// entire point of the feature -- it isn't specific to blind draft, and every other thing only that
// player can see behaves the same way. Worth stating explicitly here only because the paragraph
// above makes a privacy claim, and "self-only" should not be read as "unreachable by an admin who
// deliberately becomes that player".
export async function readOwnPicks(leagueId: string, playerId: string): Promise<string[] | null> {
  const { rows } = await pool.query(
    "SELECT castaway_ids FROM blind_draft_picks WHERE league_id=$1 AND player_id=$2",
    [leagueId, playerId]
  );
  if (!rows.length) return null;
  return rows[0].castaway_ids as string[];
}

// Called when a seat is deleted outright (RosterLogic.removePlayer) -- their submission refers to a
// player that no longer exists, and leaving the row behind would keep the reveal waiting on, or
// crediting picks to, a seat that's gone. Disabled-but-kept seats (disablePlayer) are handled
// differently: BlindDraftLogic.eligiblePlayers stops counting them so they can't deadlock the
// reveal, but any picks they already locked in still stand, matching how a disabled seat's roster
// and points are deliberately preserved elsewhere.
export async function dropBlindPicksForPlayer(client: PoolClient, leagueId: string, playerId: string): Promise<void> {
  await client.query("DELETE FROM blind_draft_picks WHERE league_id=$1 AND player_id=$2", [leagueId, playerId]);
}
