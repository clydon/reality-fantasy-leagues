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
/** C2 part 2, the week's results: what one episode added to a side's points. */
export function grown(totals: Map<string, number>, before: Map<string, number> | null, id: string): number;
/** A seat's tally in a pool, a night at a time. */
export interface PoolTally {
  current: number;
  longest: number;
  total: number;
  lives: number | null;
  mulligans: number;
  buybacks: number;
  cost: number;
  out: number | null;
  shared: boolean;
}
export interface PoolOutcome {
  correct: boolean;
  points: number;
  forgiven?: boolean;
  lifeLost?: boolean;
}
export function poolTally(parts: { lives: number | null; mulligans: number; buyback?: { times: number } | null } | null): PoolTally;
export function poolPick(t: PoolTally, right: boolean, points: number): PoolOutcome;
export function poolNight(t: PoolTally, judged: [string, boolean][], points: number): Record<string, PoolOutcome>;
export function poolEmptied(t: PoolTally, n: number, buyback: { cost: number } | null | undefined, can: (n: number) => boolean): { back: number } | { out: number } | null;
export function poolSpare(t: PoolTally, n: number, was: { lives: number | null; mulligans: number; current: number }): boolean;
export function allOut(went: number, left: number): boolean;
export function lastLeft<T>(everyone: T[], isIn: (x: T) => boolean): boolean;
export function raceWon(ids: string[], total: (id: string) => number, to: number): boolean;
/** A cut as the spec reads it (game-spec knockoutParts: CUT's defaults filled). */
export interface Cut {
  at: { every?: number; episode?: number; phase?: string };
  out: number | "half";
  tie: "keep" | "all";
  quiet: "cut" | "skip";
}
export function cut(left: string[], key: (id: string) => number[], c: Pick<Cut, "out" | "tie">): string[];
export function cutsAfter(cuts: Cut[], o: {
  k: number;
  start: number;
  quiet: boolean;
  inAt: (k: number) => string[];
  total: (id: string) => number;
  before: (n: number) => Map<string, number> | null;
  out: Map<string, number>;
  phaseStarts?: Record<string, number> | null;
}): void;
/** A series of totals: each episode a game has played, with each side's points through it. */
export interface SeriesEpisode {
  number: number;
  quiet?: boolean;
  totals: Map<string, number>;
}
export function knockouts(series: SeriesEpisode[], o: {
  start: number;
  everyone: string[];
  catching: Set<string>;
  startOf: Map<string, number | null>;
  race: { to: number } | null;
  cuts: Cut[];
  oneLeft: "ends" | "plays" | null;
  phaseStarts?: Record<string, number> | null;
}): { out: Map<string, number>; ends: number | null };
export function roundRobin(ids: string[], r: number): [string, string | null][];
export function median(values: number[]): number;
export function bracket(size: number): number[];
export function matchups(series: SeriesEpisode[], o: {
  parts: { odd: "median" | "bye"; quiet: "skip" | "tie"; playoffs: { teams: number; rounds: number } | null };
  start: number;
  from: number | null;
  finale: number | null;
  ended: boolean;
  sides: string[];
  seatsAt: (k: number) => string[];
}): {
  weeks: { number: number; quiet: boolean; games: { a: string; b: string | null; aPoints: number; bPoints: number | null; result: "a" | "b" | "tie" | null }[] }[];
  records: Map<string, { wins: number; losses: number; ties: number; for: number; against: number }>;
  from: number | null;
  seeds: string[] | null;
  rounds: { number: number; played: boolean; games: { a: string | null; b: string | null; aSeed: number | null; bSeed: number | null; aPoints: number | null; bPoints: number | null; winner: string | null }[] }[];
  alive: Set<string>;
  champion: string | null;
  tiers: Map<string, number>;
};
export function teamStep(run: Map<string, number>, grown: Map<string, number[]>, how: "sum" | "mean" | string): void;
export function saved(said: number, right: number, saves: "one" | "most" | "all" | string): boolean;
export function total(row: { locked: number; bonus: number; finale: number }, bets: boolean, rounded: boolean): number;
export function compareKeys(a: number[], b: number[]): number;
export function byTotal<T extends { total: number }>(rows: T[]): T[];
export function byKey<T>(rows: T[], key: (row: T) => number[]): T[];
export function standingKey(r: { out?: number | null; total: number; lives?: number | null; shared?: boolean }): number[];
export function recordKey(m: { tier: number; wins: number; ties: number; for: number; seed?: number | null }): number[];
