import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";

// A season game's rules in plain words, from its own settings: the new design's Rules sheet on the Games tab (the
// mock's rulesSheet). The same facts the classic "How this league works" cards tell (components/explainer), as a
// numbered list. How it works (formats/rulebook-describe.js) says the show's side; this says the game's.

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** The game's rules, a sentence each. `castaway`: what the show calls its people ("castaway"). */
export function gameRules(state: LeagueState, castaway = StateLogic.formatOf(state).terms.castaway.toLowerCase()): string[] {
  const type = StateLogic.getLeagueType(state);
  const s = state.settings;
  const people = `${castaway}s`;
  const shared = s.ownershipMode === "shared";
  const size = count(StateLogic.rosterSize(state));
  const draft = shared
    ? `Draft a team of ${size} in private; everyone's picks are revealed at once, and the same ${castaway} can be on more than one team.`
    : `Snake-draft a team of ${size}: once someone picks a ${castaway}, nobody else can have them.`;
  const rules: string[] = [];

  if (type.id === "active-roster") {
    rules.push(draft);
    rules.push(`Before each episode, start ${count(StateLogic.ActiveRosterLogic.activeSlots(state))}. Only starters score.`);
    const groups = StateLogic.formatOf(state).eventCategories.map((c) => c.label).filter(Boolean);
    rules.push(groups.length ? `Points come from what happens: ${listOf(groups)}.` : "Points come from what happens in each episode.");
    rules.push("Lineups lock when the episode starts. Change yours as often as you like until then.");
    const pickups = StateLogic.WaiverLogic.replaceRule(state) !== "never";
    const swaps = StateLogic.WaiverLogic.windows(state).swaps > 0;
    if (pickups) rules.push(`Lose someone? Pick who comes in on waivers.${swaps ? " Waiver windows let you swap someone too." : ""}`);
    else if (swaps) rules.push(`Waiver windows let you swap one of your ${people} for someone new.`);
  } else if (type.id === "weekly-calls") {
    rules.push("No draft, no team. Before each show starts, make two calls about what will happen in it.");
    rules.push("The couch says what happened as it watches: two of you agreeing settles a call.");
    rules.push("Change your calls until it starts. Nobody sees them until then.");
    rules.push("Most right calls by the finale wins.");
  } else if (type.id === "weekly-bingo") {
    rules.push("No draft, no team. Every show you get a new bingo card: nine of the show's moments, the middle one free.");
    rules.push("Tick a square when it happens. Three in a row, down or across makes a line.");
    rules.push("A square counts once the couch agrees it happened: two of you ticking it, or saying so, settles it.");
    rules.push("Most lines by the finale wins.");
  } else if (type.id === "pickem") {
    rules.push(`No draft. Before each episode, pick one ${castaway} you think stays in.`);
    rules.push("Right: your streak grows. Wrong, or no pick: it resets. Your best streak still counts.");
    rules.push(`You can't pick the same ${castaway} again until you've used everyone still in, and never two episodes in a row.`);
    rules.push("Longest streak wins; ties go to the most right picks.");
  } else {
    rules.push(draft);
    rules.push(`Each ${castaway} earns 1 point, plus 1 for every boot they outlast.`);
    rules.push("So they end on their place in the boot order: the last one standing carries you.");
    rules.push("No lineups to set. Just watch.");
  }
  if (s.bonusEnabled) {
    rules.push(`Predictions: a right answer earns its points (usually ${s.defaultBetPoints}), once at least two of you have answered.`);
  }
  const start = StateLogic.startEpisode(state);
  if (start > 1) rules.push(`Scoring starts at Episode ${start}; the episodes before it are history.`);
  return rules;
}

/** "a, b and c". */
function listOf(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
