// Moves the couch makes, from the mock (index.html heroHTML, show.js): how many have done this episode's move.
// Step 1 counts it from the leagues.
import type { Demo } from "./people";

export const STEP = "1";

/** Up next's couch line: "3 of 4 lineups set". */
export const COUCH_PROGRESS: { people: Demo[]; done: number; of: number; label: string } = {
  people: ["alex", "riley", "jordan", "sam"],
  done: 3,
  of: 4,
  label: "lineups set",
};
