// The season games' look in the new design (the mock's GAMES, show.js): a colour each and one line saying what it
// is. Keyed by the name the server gives a game (GameRef.gameName, "Weekly Lineup"). Weekly Lineup is Lake, not
// the mock's yellow: yellow is only for what you must do (the critique, 2026-10-23).

export const GAME_STYLE = {
  Outlast: { colour: "#f2804b", line: "Draft a team. Last one standing carries you." },
  "Weekly Lineup": { colour: "#5089c9", line: "Start your best three each week." },
  "Survival Pool": { colour: "#35b5a5", line: "Pick one survivor each episode. Never the same twice." },
  // The mock's predictions pink (its Weekly Calls was yellow, which is only for what you must do).
  "Weekly Calls": { colour: "#e56b9f", line: "Two calls every show. Most right by the finale wins." },
} as const;

export type GameName = keyof typeof GAME_STYLE;

export const isGameName = (name: string): name is GameName => Object.prototype.hasOwnProperty.call(GAME_STYLE, name);

/** A game's colour, or a quiet one for a game the new design doesn't know yet. */
export const gameColour = (name: string) => (isGameName(name) ? GAME_STYLE[name].colour : "var(--muted-foreground)");

/** "1st", "2nd", "11th". */
export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;
