// The season games' look in the new design (the mock's GAMES, show.js): a colour each and one line saying what it
// is. Keyed by the name the server gives a game (GameRef.gameName, "Weekly Lineup"). Weekly Lineup is Lake, not
// the mock's yellow: yellow is only for what you must do (the critique, 2026-10-23).

export const GAME_STYLE = {
  Outlast: { colour: "#f2804b", line: "Draft a team. Last one standing carries you." },
  "Weekly Lineup": { colour: "#5089c9", line: "Start your best three each week." },
  "Survival Pool": { colour: "#35b5a5", line: "Pick one survivor each episode. Never the same twice." },
  // The mock's predictions pink (its Weekly Calls was yellow, which is only for what you must do).
  "Weekly Calls": { colour: "#e56b9f", line: "Two calls every show. Most right by the finale wins." },
  // The mock's GAMES.wbingo.
  "Weekly Bingo": { colour: "#a76bb0", line: "A new card every show. Most lines by the finale wins." },
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
};

export const isGameName = (name: string): name is GameName => Object.prototype.hasOwnProperty.call(GAME_STYLE, name);

/** A game's colour, or a quiet one for a game the new design doesn't know yet. */
export const gameColour = (name: string) => (isGameName(name) ? GAME_STYLE[name].colour : "var(--muted-foreground)");

/** "1st", "2nd", "11th". */
export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;
