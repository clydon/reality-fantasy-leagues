import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";

// One person at their own pace on a live game (docs/PLAN-own-pace-games.md, the user, 2026-11-09), the server's half: a seat whose
// Commissioner switched on "Plays at their own pace" (player.ownPace) keeps its moves for an aired episode open until they've
// watched it or the next episode airs (StateLogic.GhostLogic.lateWindow). "Watched" is the seat's spoiler mark on the season
// (guard.ts seenThrough: Infinity for someone who sees results as they come in, so never behind), the lowest of a shared seat's.

type Queryable = { query: typeof pool.query };

/** The episode the seat has watched through on its game's season: the lowest of its accounts' marks; EVERYTHING when unknown. */
export async function watchMark(leagueId: string, playerId: string, db: Queryable = pool): Promise<number> {
  const { rows } = await db.query(
    `SELECT m.user_id, ss.id AS season_id FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
      WHERE m.league_id = $1 AND m.player_id = $2`,
    [leagueId, playerId]
  );
  if (!rows.length) return EVERYTHING;
  const marks = await Promise.all(rows.map((r) => seenThrough(r.user_id, r.season_id, db)));
  return Math.min(...marks);
}

/** Each seat at its own pace's mark, by player id (only theirs: the couch's "Waiting on" and the moves' window read it). */
export async function paceMarks(leagueId: string, state: LeagueState, db: Queryable = pool): Promise<Map<string, number>> {
  const seats = (state.players ?? []).filter((p) => StateLogic.GhostLogic.playsOwnPace(state, p.id));
  const out = new Map<string, number>();
  for (const p of seats) out.set(p.id, await watchMark(leagueId, p.id, db));
  return out;
}

/**
 * For a move on `epId` by a seat at its own pace whose window is open on that episode: the mark its move runs at (the episode
 * before, applyAs with `late`). Null otherwise: the move follows the ordinary rules. The state carries its air times (the
 * league's lock stamps them).
 */
export async function lateMark(leagueId: string, state: LeagueState, playerId: string | null | undefined, epId: string, db: Queryable = pool): Promise<number | null> {
  if (!playerId || !StateLogic.GhostLogic.playsOwnPace(state, playerId)) return null;
  const w = StateLogic.GhostLogic.lateWindow(state, playerId, await watchMark(leagueId, playerId, db), Date.now());
  return w && w.epId === epId ? w.episode - 1 : null;
}

/** Whether the mark says they see everything (results as they come in): the switch does nothing for them. */
export const seesEverything = (mark: number) => mark === EVERYTHING;
