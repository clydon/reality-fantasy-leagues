// Types for a bracket question's pieces (./bracket.js, docs/PLAN-start-a-game-gpt.md track L, L4 part 2).
import type { SportsGameFacts } from "../game-spec";

/** A draw as a card's facts have it: its first round (by its distance from the final), who enters where, each round's matches
 *  and winners so far, and whether its final is won. */
export interface BracketField {
  first: number | null;
  entrants: Record<string, number>;
  matches: Record<number, [string, string][]>;
  winners: Record<number, string[]>;
  over: boolean;
}
/** A bracket answer: each round's winners by its distance from the final ("1" the final). */
export type BracketAnswer = Record<string, string[]>;

export function bracketOf(bouts: SportsGameFacts["bouts"], cls: string): BracketField;
export function bracketProblem(value: unknown, field?: BracketField | null): string | null;
export function bracketPoints(q: { points?: number; rounds?: "double" | "same" }, field: BracketField | null, answer: unknown): number;
export function roundWorth(q: { points?: number; rounds?: "double" | "same" }, k: number, first: number): number;
