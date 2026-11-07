// Types for the scoring sequence's pieces for squares (./squares.js, docs/PLAN-start-a-game-gpt.md track L, L4 part 2).
import type { SportsGameFacts, SquaresParts } from "../game-spec";

/** A grid's drawn digits: `grid` groups on each side, a 10 by 10's one digit each, a 5 by 5's two. */
export interface SquaresDigits {
  rows: number[][];
  cols: number[][];
}
export type PayState = "paid" | "empty" | "void" | "waiting" | "off";
export interface SquaresPay {
  at: number | "half" | "final";
  /** Its points, with any a square nobody held rolled on to it. */
  points: number;
  state: PayState;
  /** The two scores it's paid on: the first side's (the rows'), the second's (the columns'). */
  score: [number, number] | null;
  cell: number | null;
  seat: string | null;
  rolled: number;
}

export function cellsOf(grid: number): number;
export function digitsOf(seed: string, grid: number): SquaresDigits;
export function cellOf(digits: SquaresDigits, rowScore: number, colScore: number): number;
export function dealSquares(seed: string, seats: string[], grid: number, each?: number | null): Record<string, number[]>;
export function pickProblem(value: unknown, grid: number, each?: number | null, taken?: Set<number>): string | null;
export function payScore(game: SportsGameFacts | null | undefined, at: number | "half" | "final", regulation: number): { state: "known"; score: [number, number] } | { state: "waiting" | "unread" | "off" };
export function squaresPays(parts: SquaresParts, game: SportsGameFacts | null | undefined, o: { digits: SquaresDigits | null; holders: Record<number, string>; regulation: number }): { pays: SquaresPay[]; totals: Record<string, number> };
export function holdersOf(squares: Record<string, number[]>): Record<number, string>;
