import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// Classic's list of your leagues (/api/me: the league dropdowns, the strip, the dashboard), step R1 part 2 of
// docs/PLAN-start-a-game-gpt.md: which games it lists, by the game's pieces (StateLogic.piecesOf), never its stored type. It
// leaves out the games scored outside their state (Weekly Calls, Weekly Bingo, a game of questions: the new design's only).

/** Whether classic lists this game: not one scored outside its state (the show's calls, bingo lines, its own questions). */
export function inClassicList(state: LeagueState): boolean {
  const p = StateLogic.piecesOf(state);
  return !p.hasCalls && !p.hasBingo && !p.hasQuestions;
}
