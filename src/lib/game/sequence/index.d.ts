// Types for the scoring sequence (./index.js, docs/PLAN-start-a-game-gpt.md track C, C2).

/** A mid-season move, as the log records it: made after episode `episode`'s results, so it counts from the next. */
export interface SequenceMove {
  playerId: string;
  episode?: number | null;
  addedCastawayId?: string | null;
  droppedCastawayId?: string | null;
}
/** The season as a mark sees it, for a place: the cast's size, the boots by then, and whether the game runs in reverse. */
export interface PlaceMark {
  size: number;
  out: number;
  reverse: boolean;
}
/** One moment at the game's points. */
export interface ScoredEvent {
  castawayId: string;
  points: number;
}

export function round(n: unknown): number;
export function heldAt(now: string[], log: SequenceMove[] | null | undefined, playerId: string, n: number): Set<string>;
export function placed(placement: number, mark: Pick<PlaceMark, "size" | "reverse">): number;
export function stillIn(mark: PlaceMark): number;
export function momentRaw(ids: string[], events: ScoredEvent[]): Map<string, number>;
export function groupRaw(members: string[], size: number, events: ScoredEvent[], how: "sum" | "mean" | string): number;
export function betLines<B extends { points?: number; predictions?: { playerId: string; correct: boolean | null }[] }>(bets: B[] | null | undefined): { playerId: string; points: number; bet: B }[];
export function multiply(raw: number, factors: number[]): number;
export function best<T extends { points: number; counted?: boolean }>(lines: T[], n: number): T[];
export function episodeTotal(lines: { points: number; counted?: boolean }[], slots?: { points: number }[]): number;
export function sum(values: number[]): number;
export function add(running: number, x: number): number;
export function total(row: { locked: number; bonus: number; finale: number }, bets: boolean, rounded: boolean): number;
export function compareKeys(a: number[], b: number[]): number;
export function byTotal<T extends { total: number }>(rows: T[]): T[];
export function byKey<T>(rows: T[], key: (row: T) => number[]): T[];
