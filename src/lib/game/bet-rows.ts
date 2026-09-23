import type { LeagueState } from "./types";

export interface PlayerBetRow {
  episode: number;
  label: string;
  guess: string;
  correct: boolean | null;
  points: number;
  postMerge: boolean;
}

// Port of playerBetRows() (public/app.js) -- a player's full bet-guess history across every
// episode, oldest first, with the actually-scored points already computed (0 unless correct AND
// the bet had company, since solo guesses never pay out).
export function playerBetRows(state: LeagueState, playerId: string): PlayerBetRow[] {
  const rows: PlayerBetRow[] = [];
  [...state.episodes]
    .sort((a, b) => a.number - b.number)
    .forEach((ep) => {
      (ep.bets || []).forEach((bet) => {
        const eligible = (bet.predictions || []).length >= 2;
        (bet.predictions || [])
          .filter((p) => p.playerId === playerId)
          .forEach((pred) => {
            rows.push({
              episode: ep.number,
              label: bet.label,
              guess: pred.guess,
              correct: pred.correct,
              points: pred.correct === true && eligible ? bet.points || 0 : 0,
              postMerge: ep.postMerge,
            });
          });
      });
    });
  return rows;
}
