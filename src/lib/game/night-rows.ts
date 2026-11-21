import type { MainBlock } from "./game-page/grammar";

// Tonight's night, one row a game (docs/design-round/tonight-night-spec.md; src/new/show/night.tsx): how each kind of game says
// its last episode, closed and open, keyed by the game page's main block (game-page/grammar.ts mainOf), which every spec the engine
// plays resolves to. A `Record` over every main block, so a new kind of game doesn't compile until Tonight has a design for it,
// and tests/night-rows.test.js checks the same at run time. When an engine capability is added or changed, docs/UI-REVIEW-MAP.md
// says which of these (and which other screens) to review.

/** What the closed row's faces show: your plays that episode (a lineup's starters, a team with who left, a pick or picks), or none
 *  (a game of questions, a card, a board: its line says it). */
export type NightFaces = "plays" | "none";

/**
 * The night's change, on the right:
 * - `points`: what the episode added, in points ("+3 pts"), or a team's "All safe" / "Lost 1";
 * - `night`: a pool's pick in a word ("Stayed", "Went home");
 * - `result`: head to head's "W 12–9" (points where the episode had no matchup);
 * - `lives`: the couch's lives over the episode ("No lives lost", "Lost a life");
 * - `week`: "Won the week", else points;
 * - `lines`: bingo lines ("+1 line"), or points where a line is worth more.
 */
export type NightChange = "points" | "night" | "result" | "lives" | "week" | "lines";

/**
 * The second line's words after the faces, when nobody else's night is the news:
 * - `total`: your total in the game's own measure ("19 pts", "streak 3", "2 of 3 still in");
 * - `opponent`: who you played and your record ("vs riley · 3–2");
 * - `target`: a race's distance ("12 of 20 to win");
 * - `lives`: the couch's lives left ("2 of 3 lives left");
 * - `weeks`: weeks won ("2 weeks won");
 * - `stage`: the stage that played and the overall ("Merge stage · 21 pts").
 */
export type NightLine = "total" | "opponent" | "target" | "lives" | "weeks" | "stage";

/** What opening the row shows: everyone's night (a row each), or the episode's matchups (head to head). */
export type NightOpen = "everyone" | "matchups";

export interface NightRowDesign {
  faces: NightFaces;
  change: NightChange;
  line: NightLine;
  /** Your place on the right under the change (a co-op game has none: the couch wins or loses together). */
  place: boolean;
  open: NightOpen;
  /** Where its frames are (the story's frame ids, story-tonight-night.js), or null: designed, not yet seen on a real game. */
  seen: string | null;
}

export const NIGHT_ROWS: Record<MainBlock, NightRowDesign> = {
  // How you win is the game's heart.
  together: { faces: "plays", change: "lives", line: "lives", place: false, open: "everyone", seen: null },
  race: { faces: "plays", change: "points", line: "target", place: true, open: "everyone", seen: null },
  matchup: { faces: "plays", change: "result", line: "opponent", place: true, open: "matchups", seen: null },
  categories: { faces: "plays", change: "result", line: "opponent", place: true, open: "matchups", seen: null },
  worth: { faces: "plays", change: "points", line: "total", place: true, open: "everyone", seen: null },
  week: { faces: "plays", change: "week", line: "weeks", place: true, open: "everyone", seen: null },
  // What you hold.
  board: { faces: "none", change: "points", line: "total", place: true, open: "everyone", seen: null },
  card: { faces: "none", change: "lines", line: "total", place: true, open: "everyone", seen: null },
  objectives: { faces: "plays", change: "points", line: "total", place: true, open: "everyone", seen: null },
  team: { faces: "plays", change: "points", line: "total", place: true, open: "everyone", seen: "week.open-lineup, week.open-boots, big.open" },
  picks: { faces: "plays", change: "points", line: "total", place: true, open: "everyone", seen: null },
  ladder: { faces: "plays", change: "night", line: "total", place: true, open: "everyone", seen: "week.open-pick, week.quick" },
  // The questions.
  slate: { faces: "none", change: "points", line: "total", place: true, open: "everyone", seen: null },
  ballot: { faces: "none", change: "points", line: "total", place: true, open: "everyone", seen: null },
  // A game made of games: the overall, the stage that played.
  stages: { faces: "plays", change: "points", line: "stage", place: true, open: "everyone", seen: null },
};

/** A main block's design; an unknown one (a page from before a block existed) reads as a game of questions. */
export const nightRowOf = (main: string | null | undefined): NightRowDesign => NIGHT_ROWS[(main ?? "ballot") as MainBlock] ?? NIGHT_ROWS.ballot;
