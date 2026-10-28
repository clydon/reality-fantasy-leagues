import type { SpecProblem } from "@/lib/game/game-spec/index.js";
import { HttpError } from "./db";

// Every settings write goes through the game spec's validator (state-logic.js RosterLogic.setGame, step A2 of
// docs/PLAN-start-a-game-gpt.md): StateLogic.updateSettings and setGame return what they were refused for, and wrote
// nothing. A route turns that into an answer with this.

/** Throws the first problem a write was refused for (`status`: 400 for what was asked, 409 for the game as it is). */
export function refused(problems: SpecProblem[], status = 400): void {
  if (problems.length) throw new HttpError(status, problems[0].problem);
}
