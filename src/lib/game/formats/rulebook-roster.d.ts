// Types for formats/rulebook-roster.js: whom an episode's research asks about.
import type { RulebookBlocks } from "./rulebook-schema";

export interface RosterPerson {
  name: string;
  /** When they left and what that way out means, from confirmed results. */
  left?: { episode: number; means: "out" | "finalist" | "winner" | "ending" | "outForOne" } | null;
}

export function whoToAsk(blocks: RulebookBlocks, people: RosterPerson[], episode: number): {
  ask: string[];
  skipped: { name: string; why: string }[];
  /** New people arrive in this rulebook: research must ask who's new. */
  asksArrivals: boolean;
};
export function comebackFromLeft(blocks: RulebookBlocks): boolean;
export function hasArrivals(blocks: RulebookBlocks): boolean;
