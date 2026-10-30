import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// A handicap's newcomers (docs/PLAN-start-a-game-gpt.md step A11 part 5b: the spec's rank.handicap, StateLogic.HandicapLogic): who's
// new is data, never a person's word. For each seat of a game with a handicap, how many games its accounts have had on the game's
// couch before it (`couch`), and how many of them were of this show (`show`): a game on the same couch (not this one, not deleted, not
// a practice or public game) whose season premiered before this game's (show_seasons.premiere_date; a season the catalog doesn't
// date counts from when its game was made), where the account held a seat. A team two people share is stamped with the most of its
// accounts' (new only if both are). A league on no couch has no games before it: every account on it is new, as its words say.
// Stamped into the state on a write to such a game (withLeagueLock, after the mutation, so a write that turns a handicap on or seats
// someone reads it) while the engine still needs it (HandicapLogic.needsHistory: before the game starts, or with a seat a person
// holds that isn't kept yet), for it to keep once the game starts (HandicapLogic.settle); any other game carries none. One query a
// write then, for a game with a handicap only; none once everyone's kept.
//
// The fallbacks: a seat with no account (a computer player, an empty seat) isn't in the stamp, so it isn't new; a read that fails
// leaves the stamp the last read made (logged), and a game never read has none, so nobody is new (no points from data nobody read);
// what's kept once the game has started never changes with the history.

const HISTORY_SQL = `
  WITH me AS (
    SELECT l.id, l.couch_id, s.id AS show_id, COALESCE(ss.premiere_date, l.created_at::date) AS since
      FROM leagues l
      LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
      LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
     WHERE l.id = $1
  ),
  earlier AS (
    SELECT o.id, os.id = me.show_id AS same_show
      FROM me
      JOIN leagues o ON o.couch_id = me.couch_id AND o.id <> me.id AND o.deleted_at IS NULL AND o.solo IS NULL
      LEFT JOIN shows os ON os.slug = o.state->'settings'->>'showId'
      LEFT JOIN show_seasons oss ON oss.show_id = os.id AND oss.season_number::text = o.state->'settings'->>'wikiSeason'
     WHERE COALESCE(oss.premiere_date, o.created_at::date) < me.since
  )
  SELECT m.player_id, count(DISTINCT e.id)::int AS couch, (count(DISTINCT e.id) FILTER (WHERE e.same_show))::int AS show
    FROM me
    JOIN league_memberships m ON m.league_id = me.id AND m.player_id IS NOT NULL
    LEFT JOIN league_memberships om ON om.user_id = m.user_id AND om.player_id IS NOT NULL
    LEFT JOIN earlier e ON e.id = om.league_id
   GROUP BY m.player_id, m.user_id`;

/** Each seat's history on the game's couch (playerId -> { couch, show }: games before this one), the most of its accounts'. */
export async function seatHistoryOf(db: Pool | PoolClient, leagueId: string): Promise<Record<string, { couch: number; show: number }>> {
  const { rows } = await db.query(HISTORY_SQL, [leagueId]);
  const out: Record<string, { couch: number; show: number }> = {};
  for (const r of rows) {
    const was = out[r.player_id];
    out[r.player_id] = { couch: Math.max(was?.couch ?? 0, r.couch), show: Math.max(was?.show ?? 0, r.show) };
  }
  return out;
}

/**
 * Stamps a game with a handicap with each seat's history (state.seatHistory) while the engine needs it; clears it from any other
 * game. `inTransaction`: `db` is a client inside an open transaction (withLeagueLock's), so the read goes in a savepoint: a failed
 * statement would otherwise abort the whole write. A failed read keeps the stamp it had.
 */
export async function stampSeatHistory(db: Pool | PoolClient, leagueId: string, state: LeagueState, inTransaction = false): Promise<void> {
  if (!StateLogic.HandicapLogic.on(state)) {
    delete state.seatHistory;
    return;
  }
  if (!StateLogic.HandicapLogic.needsHistory(state, Date.now())) return;
  if (inTransaction) await db.query("SAVEPOINT seat_history");
  try {
    const history = await seatHistoryOf(db, leagueId);
    if (inTransaction) await db.query("RELEASE SAVEPOINT seat_history");
    state.seatHistory = history;
  } catch (e) {
    if (inTransaction) await db.query("ROLLBACK TO SAVEPOINT seat_history").catch(() => {});
    console.error("[handicaps] couldn't read the couch's history:", e);
  }
}
