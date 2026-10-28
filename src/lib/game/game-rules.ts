import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { describeSpec } from "./game-spec/index.js";

// A season game's rules in plain words: the new design's Rules sheet on the Games tab (the mock's rulesSheet). Read from
// the game's spec (docs/PLAN-start-a-game-gpt.md step A2): the How it works game-spec describeSpec gives every game, in
// the show's words. The same facts the classic "How this league works" cards tell (components/explainer), as a numbered
// list. How it works (formats/rulebook-describe.js) says the show's side; this says the game's.

/** The game's rules, a sentence each. `castaway`: what the show calls its people ("castaway"). */
export function gameRules(state: LeagueState, castaway = StateLogic.formatOf(state).terms.castaway.toLowerCase()): string[] {
  const groups = StateLogic.formatOf(state).eventCategories.map((c) => c.label).filter(Boolean) as string[];
  return describeSpec(StateLogic.gameOf(state), { castaway, groups }).rules;
}
