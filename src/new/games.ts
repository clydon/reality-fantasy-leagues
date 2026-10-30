// The season games' look in the new design (the mock's GAMES, show.js): a colour each and one line saying what it
// is. Keyed by the name the server gives a game (GameRef.gameName, "Weekly Lineup"). Weekly Lineup is Lake, not
// the mock's yellow: yellow is only for what you must do (the critique, 2026-10-23).

export const GAME_STYLE = {
  Outlast: { colour: "#f2804b", line: "Draft a team. Last one standing carries you." },
  "Weekly Lineup": { colour: "#5089c9", line: "Start your best three each week." },
  // Its repeats as the pool plays them (PickEmLogic.eligibility's cycle rule): anyone again once you've picked everyone still in.
  "Survival Pool": { colour: "#35b5a5", line: "Pick one survivor each episode. No repeats until you've picked everyone still in." },
  // The mock's predictions pink (its Weekly Calls was yellow, which is only for what you must do).
  "Weekly Calls": { colour: "#e56b9f", line: "Two calls every show. Most right by the finale wins." },
  // The mock's GAMES.wbingo.
  "Weekly Bingo": { colour: "#a76bb0", line: "A new card every show. Most lines by the finale wins." },
  // A game of questions (step A4 part 2 of docs/PLAN-start-a-game-gpt.md): lime, the one colour the other five leave.
  "Prediction Sheet": { colour: "#9bc25b", line: "A few questions before each episode. Most points by the finale wins." },
} as const;

export type GameName = keyof typeof GAME_STYLE;

/**
 * How each game works in plain words, for Settings' Help (the mock's rulesSheet; step 15 part 1): the same sentences each
 * game's own Rules sheet says (game-rules.ts), without one game's numbers.
 */
export const HOW_EACH_GAME: Record<GameName, string[]> = {
  Outlast: [
    "Draft a team before the season: once someone picks a castaway, nobody else can have them.",
    "Each castaway earns 1 point, plus 1 for every boot they outlast.",
    "So they end on their place in the boot order: the last one standing carries you.",
    "No lineups to set. Just watch.",
  ],
  "Weekly Lineup": [
    "Draft a roster before the season.",
    "Before each episode, pick who starts. Only starters score.",
    "Points come from what happens in each episode: the show's How it works says what counts.",
    "Lose someone? Pick who comes in on waivers.",
  ],
  "Survival Pool": [
    "No draft. Before each episode, pick one castaway you think stays in.",
    "Right: your streak grows. Wrong, or no pick: it resets. Your best streak still counts.",
    "You can't pick the same castaway again until you've used everyone still in.",
    "Longest streak wins; ties go to the most right picks.",
  ],
  "Weekly Calls": [
    "For talk and variety shows. No draft, no team: before each show, make two calls about what will happen.",
    "The couch says what happened as it watches: two of you agreeing settles a call.",
    "Most right calls by the finale wins.",
  ],
  "Weekly Bingo": [
    "For talk and variety shows. Every show you get a new card: nine of its moments, the middle one free.",
    "Tick a square when it happens. Three in a row makes a line.",
    "Most lines by the finale wins.",
  ],
  "Prediction Sheet": [
    "No draft, no team. Before each episode, answer a few questions about it: who goes home, whether something happens.",
    "A few are for the whole season, like who wins: answer them before the game starts.",
    "Nobody sees your answers until they lock. The results settle every one, and each right answer scores its points.",
    "Most points by the finale wins.",
  ],
};

export const isGameName = (name: string): name is GameName => Object.prototype.hasOwnProperty.call(GAME_STYLE, name);

/** A game's colour, or a quiet one for a game the new design doesn't know yet. */
export const gameColour = (name: string) => (isGameName(name) ? GAME_STYLE[name].colour : "var(--muted-foreground)");

/** A game's colour as text (step 15 part 4): the colour itself on Night, a deeper shade of it on Studio, where the bright one is
 *  under 3:1 (new.css --nd-ink-mix: the colour mixed with the ink, 62% of it, 4.7:1 or better on Studio's ground). */
export const gameInk = (name: string) => (isGameName(name) ? inkOf(GAME_STYLE[name].colour) : "var(--muted-foreground)");

/** Any bright colour as text, the same way. */
export const inkOf = (colour: string) => `color-mix(in oklab, ${colour} var(--nd-ink-mix, 100%), var(--foreground))`;

/** "1st", "2nd", "11th". */
export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;
