import type { LeagueState } from "./types";

export interface PlayerPickRow {
  episode: number;
  postMerge: boolean;
  castawayName: string;
  correct: boolean | null; // null = episode hasn't happened yet (no eliminations logged for it)
  points: number;
}

// A player's full pick'em history across every episode, oldest first, with the actually-scored
// points already computed -- same shape/purpose as bet-rows.ts's playerBetRows for the
// Scoreboard's disclosure UI, but for pickem's own scoring rule instead of bets'. Mirrors
// PickEmScoringStrategy.compute in state-logic.js exactly (including the "an episode with no
// events logged hasn't happened yet" gate) -- if that logic changes, this needs to change with
// it.
export function playerPickRows(state: LeagueState, playerId: string): PlayerPickRow[] {
  const pointsPerCorrect = typeof state.settings.pickemCorrectPoints === "number" ? state.settings.pickemCorrectPoints : 1;
  const rows: PlayerPickRow[] = [];
  [...state.episodes]
    .sort((a, b) => a.number - b.number)
    .forEach((ep) => {
      const pick = (ep.picks || []).find((pk) => pk.playerId === playerId);
      if (!pick) return;
      const castaway = state.castaways.find((c) => c.id === pick.castawayId);
      const decided = ep.events.length > 0;
      const correct = decided ? !ep.events.some((ev) => ev.castawayId === pick.castawayId) : null;
      rows.push({
        episode: ep.number,
        postMerge: ep.postMerge,
        castawayName: castaway?.name || "?",
        correct,
        points: correct === true ? pointsPerCorrect : 0,
      });
    });
  return rows;
}
