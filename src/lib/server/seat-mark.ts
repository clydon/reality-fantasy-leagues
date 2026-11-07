import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";

/**
 * A seat's spoiler mark in one league (steps A14 parts 4 and 5: the roles and twist routes): the season's mark (guard.ts
 * seenThrough), or a late joiner's own week if earlier (their league's results_seen_through, else the week before they started),
 * as season-games.ts markFor has it for the Games tab. EVERYTHING when they see it all.
 */
export async function seatMark(userId: string, leagueId: string, state: LeagueState, seat: string | null): Promise<number> {
  const [season, own] = await Promise.all([
    pool.query(`SELECT ss.id FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE l.id = $1`, [leagueId]),
    pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]),
  ]);
  let mark = season.rows[0]?.id ? await seenThrough(userId, season.rows[0].id) : EVERYTHING;
  const late = seat ? StateLogic.GhostLogic.lateJoinOf(state, seat) : null;
  if (late?.catchingUp) mark = Math.min(own.rows[0]?.results_seen_through ?? (Number.isInteger(late.startEpisode) ? (late.startEpisode as number) - 1 : 0), mark);
  return mark;
}
