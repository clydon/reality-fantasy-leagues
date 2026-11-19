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

/** Each account's mark on a season, remembered for one read of many games (E2: a season's games share their people, so their marks
 *  are read once, not once a game). Keyed "user|season". */
export type MarkMemo = Map<string, Promise<number>>;

/**
 * Each seat at its own pace's mark, by player id (only theirs: the couch's "Waiting on" and the moves' window read it): the lowest of
 * its accounts' marks (watchMark's, read for every seat in one query), EVERYTHING when it has none. In a live game every person's seat
 * plays at its own pace, so a season of short games asked this of every seat of every game (E2: 7 of a busy season's 8.4 seconds);
 * `memo` keeps each account's mark across the games of one read.
 */
export async function paceMarks(leagueId: string, state: LeagueState, db: Queryable = pool, memo?: MarkMemo): Promise<Map<string, number>> {
  const seats = (state.players ?? []).filter((p) => StateLogic.GhostLogic.playsOwnPace(state, p.id)).map((p) => p.id);
  const out = new Map<string, number>();
  if (!seats.length) return out;
  const { rows } = await db.query(
    `SELECT m.player_id, m.user_id, ss.id AS season_id FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
      WHERE m.league_id = $1 AND m.player_id = ANY($2::text[])`,
    [leagueId, seats]
  );
  const seen = (userId: string, seasonId: string): Promise<number> => {
    const key = `${userId}|${seasonId}`;
    let mark = memo?.get(key);
    if (!mark) {
      mark = seenThrough(userId, seasonId, db);
      memo?.set(key, mark);
    }
    return mark;
  };
  const marks = await Promise.all(rows.map(async (r) => [r.player_id as string, await seen(r.user_id, r.season_id)] as const));
  for (const id of seats) {
    const mine = marks.filter(([p]) => p === id).map(([, m]) => m);
    out.set(id, mine.length ? Math.min(...mine) : EVERYTHING);
  }
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
