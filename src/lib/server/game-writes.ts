import type { SpecProblem } from "@/lib/game/game-spec/index.js";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { HttpError } from "./db";

// Every settings write goes through the game spec's validator (state-logic.js RosterLogic.setGame, step A2 of
// docs/PLAN-start-a-game-gpt.md): StateLogic.updateSettings and setGame return what they were refused for, and wrote
// nothing. A route turns that into an answer with this.

/** Throws the first problem a write was refused for (`status`: 400 for what was asked, 409 for the game as it is). */
export function refused(problems: SpecProblem[], status = 400): void {
  if (problems.length) throw new HttpError(status, problems[0].problem);
}

/**
 * A side bet's lock (step A4 of docs/PLAN-start-a-game-gpt.md; BetLogic.closed): its episode's, as a lineup's (at its start
 * unless whoever runs the game kept it open, and for good once it has results). Throws 409 when that episode is locked, so a
 * route says why instead of quietly doing nothing.
 */
export function refuseLockedBet(state: LeagueState, epId: string): void {
  const ep = state.episodes.find((e) => e.id === epId);
  if (ep && StateLogic.BetLogic.closed(ep)) throw new HttpError(409, `Predictions for Episode ${ep.number} closed when it started`);
}
