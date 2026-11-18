import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { describeSpec } from "./game-spec/index.js";
import { stable } from "./saved-recipe";

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

/** A game's rules as one short fingerprint (its spec written stably, hashed): the setup's sentence stands only while it matches. */
export function gameFingerprint(game: unknown): string {
  const text = stable(game);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** The game's short line and its plain sentence, from one reading of its spec (game-view.ts). The sentence: the title card's on the
 *  game's own page while nothing has scored for you (docs/design-round/b1-title-card-spec.md, "The sentence"): the setup card's own
 *  words when it was made in Start a game and its rules are still those (start-spec.ts keeps both), else the engine's first sentence
 *  with its kind's name and its numbers left off. */
export function gameWords(state: LeagueState, castaway = StateLogic.formatOf(state).terms.castaway.toLowerCase()): { short: string; sentence: string } {
  const format = StateLogic.formatOf(state);
  const groups = format.eventCategories.map((c) => c.label).filter(Boolean) as string[];
  const game = StateLogic.gameOf(state);
  const d = describeSpec(game, { castaway, groups, group: format.terms.tribe });
  const short = d.short?.line ?? "";
  const kept = state.settings as unknown as { about?: unknown; aboutOf?: unknown };
  if (typeof kept.about === "string" && kept.about.trim() && kept.aboutOf === gameFingerprint(game)) return { short, sentence: kept.about.trim() };
  const s = d.sentence ?? "";
  // A kind's name, and a game in stages' first stage's too ("A game in stages: Draft, an Outlast: …"), left off the front.
  const KIND = /^(?:[^,:]{1,30}, )?(?:An?|The|an?|the) [^:]{1,40}:\s*/;
  let first = (s.split(/(?<=\.)\s+/)[0] ?? "").replace(KIND, "").replace(KIND, "");
  // No numbers: which episode or game is the week block's to say, in its own count (a sport's "G 3" isn't the season's Game 5).
  first = first
    .replace(/,? (?:from |before |for |in |over )?(?:the )?(?:Episode|Game|Week|Race|Round|Episodes|Games|Weeks) \d+(?:(?: to |–)(?:the finale|(?:Episode|Game|Week|Race|Round) )?\d*)?(?: to the finale)?/g, "")
    .replace(/\s+([:,.])/g, "$1")
    .replace(/:\s*\./, ".");
  // Two lines at a phone's width, cut where a clause ends, never mid-word.
  if (first.length > 110) first = `${first.slice(0, 110).replace(/[,:;]?\s+\S*$/, "").replace(/[,:;]$/, "")}.`;
  return { short, sentence: first.charAt(0).toUpperCase() + first.slice(1) };
}
