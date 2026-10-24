// Streaming on the couch, the rail under the guide (the mock's streaming.js): shows with no airtime, at your own
// pace. Step 14 makes it real.
import { art, type Demo } from "./people";

export const STEP = "14";

export interface RailChip {
  name: string;
  art: string;
  position?: string;
  /** you: where you're up to (the one yellow); new: just dropped; good: a planned Watch along; plain: the service. */
  tag: { text: string; tone?: "you" | "new" | "good" };
  faces: Demo[];
  who: string;
  /** On your list: how far through you are, 0 to 1. Not on it: a ＋ to add it. */
  progress?: number;
}

export const RAIL: RailChip[] = [
  { name: "Severance", art: art("severance"), tag: { text: "Continue · Ep 4", tone: "you" }, faces: ["riley", "jordan"], who: "riley Ep 6 · +1", progress: 3 / 10 },
  { name: "The Wire", art: art("the-wire"), tag: { text: "HBO Max" }, faces: ["jordan"], who: "jordan · Ep 3" },
  { name: "Slow Horses", art: art("slow-horses"), tag: { text: "New · all 6 out", tone: "new" }, faces: ["sam"], who: "sam · Ep 2" },
  { name: "Stranger Things", art: art("stranger-things"), tag: { text: "Watch along · Fri 9:00 PM", tone: "good" }, faces: ["riley", "sam"], who: "riley · +1", progress: 0 },
];
