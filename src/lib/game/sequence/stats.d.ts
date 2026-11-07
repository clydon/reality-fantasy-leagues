// Types for the scoring sequence's line for a sport's stats (./stats.js, docs/PLAN-start-a-game-gpt.md track L, L3 part 1).
import type { ScoredEvent } from "./index";

/** A spec's score by a sport's stats (the game spec's `score` when `by` is "stats"). */
export interface StatScore {
  by?: "stats";
  points?: Record<string, number>;
  byPosition?: Record<string, Record<string, number>>;
  byPlace?: Record<string, Record<string, number>>;
  byFormat?: Record<string, Record<string, number>>;
}
/** One stat's part of someone's points: its value (a place, for a place) and what it scored; `bout`, the bout it was in, when its
 *  points were its format's. */
export interface StatPart {
  stat: string;
  value: number;
  points: number;
  bout?: string;
}
/** Someone's points and the stats that made them, in the table's order (counts, then places). */
export interface Scored {
  points: number;
  parts: StatPart[];
}

/** A bout someone fought on a card, for a table by its bouts' formats: its id, its rounds or sets, and their own line in it. */
export interface StatBout {
  id: string;
  format: number | string | null;
  line: Record<string, number>;
}

/** Rounded to the cent, as every point here is. */
export function cents(n: number): number;
export function placePoints(table: Record<string, number>, place: number | null | undefined): number;
export function statLine(score: StatScore, line: Record<string, number>, o?: { group?: string | null; format?: number | string | null; bouts?: StatBout[] }): Scored;
export function statMoments(lines: Record<string, Record<string, number>> | null | undefined, score: StatScore, groupOf?: (id: string) => string | null | undefined, boutsOf?: (id: string) => StatBout[] | null | undefined): ScoredEvent[];
