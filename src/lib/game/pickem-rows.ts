import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";

export interface PlayerPickRow {
  episode: number;
  postMerge: boolean;
  /** Null for an episode that happened with no pick from this player (which breaks their streak). */
  castawayName: string | null;
  castawayId: string | null;
  correct: boolean | null; // null = episode hasn't happened yet (no eliminations logged for it)
  points: number;
  /** Their streak after this episode. */
  streak: number;
}

// A player's full pick'em history across every episode, oldest first, for the Scoreboard's
// disclosure. The walk itself is PickEmLogic.history in state-logic.js -- the same one scoring uses --
// so the history shown can't disagree with the score.
export function playerPickRows(state: LeagueState, playerId: string): PlayerPickRow[] {
  return StateLogic.pickEmHistory(state, playerId).rows.map((row) => ({
    episode: row.episode,
    postMerge: row.postMerge,
    castawayName: row.castawayId ? StateLogic.getCastaway(state, row.castawayId)?.name || "?" : null,
    castawayId: row.castawayId ?? null,
    correct: row.correct,
    points: row.points,
    streak: row.streak,
  }));
}
