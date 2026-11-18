import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { describeSpec } from "./game-spec/index.js";

// A season game's rules in plain words: the new design's Rules sheet on the Games tab (the mock's rulesSheet). Read from
// the game's spec (docs/PLAN-start-a-game-gpt.md step A2): the How it works game-spec describeSpec gives every game, in
// the show's words. The same facts the classic "How this league works" cards tell (components/explainer), as a numbered
// list. How it works (formats/rulebook-describe.js) says the show's side; this says the game's.

/** The game's rules, a sentence each. `castaway`: what the show calls its people ("castaway"). */
export function gameRules(state: LeagueState, castaway = StateLogic.formatOf(state).terms.castaway.toLowerCase()): string[] {
  const format = StateLogic.formatOf(state);
  const groups = format.eventCategories.map((c) => c.label).filter(Boolean) as string[];
  return describeSpec(StateLogic.gameOf(state), { castaway, groups, group: format.terms.tribe }).rules;
}

/** The game's short line ("All season · Pick 1 to stay in"): its title card's (describe.js short). */
export function gameShort(state: LeagueState, castaway = StateLogic.formatOf(state).terms.castaway.toLowerCase()): string {
  const format = StateLogic.formatOf(state);
  const groups = format.eventCategories.map((c) => c.label).filter(Boolean) as string[];
  return describeSpec(StateLogic.gameOf(state), { castaway, groups, group: format.terms.tribe }).short?.line ?? "";
}

/** The game in one plain sentence ("A Survival Pool: everyone picks one castaway to stay in each episode, all season."): the title
 *  card's on the game's own page until you've made a move (docs/design-round/b1-title-card-spec.md, "The sentence"). */
export function gameSentence(state: LeagueState, castaway = StateLogic.formatOf(state).terms.castaway.toLowerCase()): string {
  // The setup card's own sentence when the game was made in Start a game (start-spec.ts keeps it), so the page says what its maker read.
  const about = (state.settings as unknown as { about?: unknown }).about;
  if (typeof about === "string" && about.trim()) return about.trim();
  const format = StateLogic.formatOf(state);
  const groups = format.eventCategories.map((c) => c.label).filter(Boolean) as string[];
  const s = describeSpec(StateLogic.gameOf(state), { castaway, groups, group: format.terms.tribe }).sentence ?? "";
  // Its kind's name left off the front ("A Weekly Lineup: everyone drafts 5…"): the card above already names the game, as its maker did.
  // A kind's name, and a game in stages' first stage's too ("A game in stages: Draft, an Outlast: …"), left off the front.
  const KIND = /^(?:[^,:]{1,30}, )?(?:An?|The|an?|the) [^:]{1,40}:\s*/;
  let first = (s.split(/(?<=\.)\s+/)[0] ?? "").replace(KIND, "").replace(KIND, "");
  // No numbers: which episode or game is the week block's to say, in its own count (a sport's "G 3" isn't the season's Game 5).
  first = first
    .replace(/,? (?:from |before |for |in |over )?(?:the )?(?:Episode|Game|Week|Race|Round|Episodes|Games|Weeks) \d+(?:(?: to |–)(?:the finale|(?:Episode|Game|Week|Race|Round) )?\d*)?(?: to the finale)?/g, "")
    .replace(/\s+([:,.])/g, "$1")
    .replace(/:\s*\./, ".");
  // Two lines at a phone's width, cut where a clause ends, never mid-word (the check's P1).
  if (first.length > 110) first = `${first.slice(0, 110).replace(/[,:;]?\s+\S*$/, "").replace(/[,:;]$/, "")}.`;
  return first.charAt(0).toUpperCase() + first.slice(1);
}
