import type { PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { lockedIdsFor } from "./blind-draft";

// An auction's sealed bids (step A10 part 3b of docs/PLAN-start-a-game-gpt.md: StateLogic.AuctionLogic). They're private until
// the auction settles, so they live where a blind draft's picks do, in blind_draft_picks (db/migrations/0004 says why: `state`
// is returned wholesale by every route, so a private submission kept in it would be readable from anyone's Network tab), its
// castaway_ids column holding the sheet, [{ castawayId, bid }]. A row is that player's lock; the state holds only who has
// locked in (state.auction.lockedPlayerIds), rewritten from the rows. The rows are deleted when it settles: ownership and the
// draft's log (each line's price) are the record then.
//
// Each function takes the client of a transaction holding the league's row lock (withLeagueLock), so locking, the "is everyone
// in now?" read and the settling happen under it. Who's in is read as a blind draft's is (blind-draft.ts lockedIdsFor), and a
// withdrawal is checked for its own kind of draft first (draft.ts), since the two share the table. Reading your own bids back is
// draft.ts's (readOwnBids: self only, as readOwnPicks).

export interface Bid {
  castawayId: string;
  bid: number;
}

/** Stores one player's sealed bids (validated by the caller: AuctionLogic.validateBids), republishes who's locked in, and settles
 *  the auction in the same transaction when that was the last sheet. */
export async function lockAuctionBids(client: PoolClient, leagueId: string, state: LeagueState, playerId: string, bids: Bid[]): Promise<{ lockedPlayerIds: string[]; settled: boolean }> {
  await client.query(
    `INSERT INTO blind_draft_picks (league_id, player_id, castaway_ids) VALUES ($1,$2,$3::jsonb)
     ON CONFLICT (league_id, player_id) DO UPDATE SET castaway_ids=EXCLUDED.castaway_ids, locked_at=now()`,
    [leagueId, playerId, JSON.stringify(bids)]
  );
  const locked = await lockedIdsFor(client, leagueId);
  StateLogic.AuctionLogic.setLockedPlayerIds(state, locked);
  if (!StateLogic.AuctionLogic.allLockedIn(state, locked)) return { lockedPlayerIds: locked, settled: false };
  await settleAuction(client, leagueId, state);
  return { lockedPlayerIds: [], settled: true };
}

/** Withdraws a sheet before the auction settles, so it can be done again. */
export async function unlockAuctionBids(client: PoolClient, leagueId: string, state: LeagueState, playerId: string): Promise<string[]> {
  await client.query("DELETE FROM blind_draft_picks WHERE league_id=$1 AND player_id=$2", [leagueId, playerId]);
  const locked = await lockedIdsFor(client, leagueId);
  StateLogic.AuctionLogic.setLockedPlayerIds(state, locked);
  return locked;
}

/** Settles the auction with every sheet locked in now (someone without one: their team filled, or left short, as the spec says),
 *  and clears the sheets. False when it isn't an open auction. */
export async function settleAuction(client: PoolClient, leagueId: string, state: LeagueState): Promise<boolean> {
  const { rows } = await client.query("SELECT player_id, castaway_ids FROM blind_draft_picks WHERE league_id=$1", [leagueId]);
  const bids: Record<string, Bid[]> = {};
  for (const r of rows) bids[r.player_id as string] = Array.isArray(r.castaway_ids) ? (r.castaway_ids as Bid[]) : [];
  if (!StateLogic.AuctionLogic.settle(state, bids)) return false;
  await client.query("DELETE FROM blind_draft_picks WHERE league_id=$1", [leagueId]);
  return true;
}

/** An auction whose bidding closed with sheets still out (its first episode started: AuctionLogic.due), settled now, so nobody
 *  waits for someone. Every write to a league runs it (withLeagueLock), and a read that finds it due writes (readyLeague). */
export async function settleDueAuction(client: PoolClient, leagueId: string, state: LeagueState): Promise<boolean> {
  return StateLogic.AuctionLogic.due(state, Date.now()) ? settleAuction(client, leagueId, state) : false;
}
