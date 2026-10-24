// Moves the couch makes, from the mock (index.html heroHTML, show.js, dock.js movesSheet): how many have done this
// episode's move, and the "Your moves" sheet's lineup, pool pick, predictions and Outlast team. Step 1 reads them
// from the leagues and writes through the lineup, pick and bet endpoints.
import type { Demo } from "./people";

export const STEP = "1";

/** Up next's couch line: "3 of 4 lineups set". */
export const COUCH_PROGRESS: { people: Demo[]; done: number; of: number; label: string } = {
  people: ["alex", "riley", "jordan", "sam"],
  done: 3,
  of: 4,
  label: "lineups set",
};

/** The Episodes tab's this-week line. */
export const EPISODE_PROGRESS = "3 of 4 lineups set · 2 of 4 picked";

/** The sheet, for Episode 5 (first names from fixtures/cast.ts). */
export const MOVES = {
  episode: 5,
  locks: "Wed 8:05 PM",
  lineup: { slots: 3, roster: ["Kristin", "Mike", "Brady", "Jenna", "Eric"], starters: ["Kristin", "Mike"], replace: { who: "Jenna", due: "Tue 8:05 PM" } },
  pool: { streak: 3, used: ["Kristin", "Maggie", "Brady"] },
  predictions: [
    { key: "out", q: "Who goes home?", options: ["Brady", "Danny", "Devin", "Jelly"] },
    { key: "idol", q: "Will an idol be played?", options: ["Yes", "No"] },
  ],
  outlast: ["Kristin", "Mike", "Jenna", "Eric"],
};
