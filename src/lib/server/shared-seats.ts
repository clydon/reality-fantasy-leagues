import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { LeagueState } from "@/lib/game/types";

// A team two people share (docs/PLAN-start-a-game-gpt.md step A10 part 4b: "My partner and I share one team"). A game whose
// spec shares its seats (extras.seats: { people }, settings.seatPeople) lets up to that many accounts hold one seat, each its
// own league_memberships row on the same player_id (db/migrations/0202: seat_slot numbers them, 0 the seat's first). What
// rides on it, and each piece's fallback:
//   - joining: a second person joins by an invite to the seat (invites route, join-league.ts), while the game shares and the
//     seat has room, nobody new is shut out (Who can join locked, Lock it down) and the seat isn't catching up as a late joiner.
//     An invite that can't share any more lets them in as a new player, as a hand-over invite whose seat was taken does.
//   - acting: every act-for-a-seat check compares the seat with the caller's membership (requireLeagueRole's playerId), so
//     any of them can make the seat's moves; the last write wins. Who made each is recorded where nothing else records it
//     (recordSeatMove, below: lineups, picks, group slots, side bets, finale picks, blind sheets, draft picks).
//   - marks: each person keeps their own spoiler mark (results_seen_through); where the seat's own state depends on one (a late
//     joiner's week, their catching up) it's the lowest of the seat's (seatMark): fail closed.
//   - leaving: one leaving keeps the seat for the others (backstage-members.ts freeSeat, the leave route); the last one leaving
//     frees it as before.
//   - the couch: each person on a seat is credited with its result (couch-hub.ts), one team in the game's own table.
// A game that stops sharing keeps everyone already on a seat until they leave; nobody new joins one.

type Queryable = Pool | PoolClient;

/** How many accounts one of this game's seats can hold (extras.seats): 1 unless it shares them. */
export function seatRoom(state: LeagueState): number {
  return Spec.seatPeople(StateLogic.gameOf(state));
}

/** The accounts on a seat, its first first (seat_slot). */
export async function seatAccounts(db: Queryable, leagueId: string, playerId: string): Promise<{ userId: string; slot: number }[]> {
  const { rows } = await db.query("SELECT user_id, seat_slot FROM league_memberships WHERE league_id = $1 AND player_id = $2 ORDER BY seat_slot, created_at", [leagueId, playerId]);
  return rows.map((r) => ({ userId: r.user_id as string, slot: Number(r.seat_slot) }));
}

/** Whether anyone but `userId` holds the seat (a team they share): leaving it then keeps it for them. */
export async function othersOnSeat(db: Queryable, leagueId: string, playerId: string, userId: string): Promise<boolean> {
  const { rows } = await db.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND player_id = $2 AND user_id <> $3 LIMIT 1", [leagueId, playerId, userId]);
  return rows.length > 0;
}

/** The lowest seat_slot none of `taken` holds. */
export function freeSlot(taken: number[]): number {
  const used = new Set(taken);
  let n = 0;
  while (used.has(n)) n++;
  return n;
}

/**
 * Whether another account can join the seat `playerId` to share it: `{ slot }` (the one it takes) or `{ problem }` (why not, in
 * words). Only a seat someone already holds is shared (a seat nobody holds is handed over: join-league.ts takeableSeat).
 * Inside the league's lock where it's written (join-league.ts), so two joining at once can't both take the last place.
 * `back`: someone put back on a team they shared (Undo, the desk's Put back: league-changes.ts restoreMember), who isn't new,
 * so Who can join doesn't shut them out.
 */
export async function shareCheck(db: Queryable, leagueId: string, state: LeagueState, playerId: string, opts: { back?: boolean } = {}): Promise<{ slot: number } | { problem: string }> {
  const seat = state.players.find((p) => p.id === playerId);
  if (!seat || seat.disabled) return { problem: "That team isn't in the game now" };
  const room = seatRoom(state);
  if (room < 2) return { problem: "This game has one person a team" };
  if (!opts.back && !StateLogic.GhostLogic.allowed(state)) return { problem: "Nobody new can join this game" };
  const lj = StateLogic.GhostLogic.lateJoinOf(state, playerId);
  if (lj && (lj.catchingUp || lj.startEpisode === null || StateLogic.GhostLogic.isGhost(seat))) {
    return { problem: "They're still catching up: join their team once they've caught up" };
  }
  const on = await seatAccounts(db, leagueId, playerId);
  if (!on.length) return { problem: "Nobody's on that team yet" };
  if (on.length >= room) return { problem: `That team is full: ${room === 2 ? "two" : room} people share it` };
  return { slot: freeSlot(on.map((a) => a.slot)) };
}

/**
 * The seat's mark where its own state depends on one (a late joiner's week, their catching up): the lowest of its accounts'
 * marks (each account's results_seen_through, or `unset` where it has none), so no one on it is carried past what they've seen.
 * Null for a seat nobody holds.
 */
export async function seatMark(db: Queryable, leagueId: string, playerId: string, unset: number): Promise<number | null> {
  const { rows } = await db.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND player_id = $2", [leagueId, playerId]);
  if (!rows.length) return null;
  return Math.min(...rows.map((r) => (Number.isInteger(r.results_seen_through) ? (r.results_seen_through as number) : unset)));
}

/** The kinds of move recordSeatMove records. */
export type SeatMoveKind = "lineup" | "pick" | "groupSlot" | "prediction" | "finale" | "sheet" | "draft";

/**
 * Who made a seat's move, on a seat two or more accounts share (nothing else records it: a lineup, a pick, a group slot, a side
 * bet's guess, finale picks, a blind sheet, a draft pick), as its latest of that kind for that episode (`episodeId`; '' for one
 * that isn't an episode's). Written only where the seat is shared, so nothing changes for any other game. In the move's own
 * transaction (withLeagueLock's client); best effort, as the change log is: a failure costs the record, never the move.
 */
export async function recordSeatMove(client: PoolClient, leagueId: string, playerId: string | null | undefined, userId: string, kind: SeatMoveKind, episodeId = ""): Promise<void> {
  if (!playerId) return;
  await client.query("SAVEPOINT seat_move");
  try {
    await client.query(
      `INSERT INTO seat_moves (league_id, player_id, kind, episode_id, user_id)
       SELECT $1::uuid, $2::text, $3::text, $4::text, $5::text
        WHERE (SELECT count(*) FROM league_memberships WHERE league_id = $1::uuid AND player_id = $2::text) > 1
       ON CONFLICT (league_id, player_id, kind, episode_id) DO UPDATE SET user_id = EXCLUDED.user_id, at = now()`,
      [leagueId, playerId, kind, episodeId, userId]
    );
    await client.query("RELEASE SAVEPOINT seat_move");
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT seat_move");
    console.error(`[shared-seats] league ${leagueId}: couldn't record who made ${playerId}'s ${kind}:`, e);
  }
}

/** Who made each of a seat's moves (recordSeatMove), newest first. */
export async function seatMoves(db: Queryable, leagueId: string, playerId: string): Promise<{ kind: SeatMoveKind; episodeId: string; userId: string | null; at: string }[]> {
  const { rows } = await db.query("SELECT kind, episode_id, user_id, at FROM seat_moves WHERE league_id = $1 AND player_id = $2 ORDER BY at DESC", [leagueId, playerId]);
  return rows.map((r) => ({ kind: r.kind, episodeId: r.episode_id, userId: r.user_id, at: new Date(r.at).toISOString() }));
}
