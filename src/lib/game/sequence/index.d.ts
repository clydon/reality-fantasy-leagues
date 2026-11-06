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
/** C2 part 3, outside the state: a window's lines (each answer's right ones at its worth), a shrinking call's worth, a rollover's
 *  jackpot and what it carries, and right calls or bingo lines counted. */
export function windowLines(units: Map<string, number>, worthOf: (playerId: string) => number): Map<string, number>;
export function shrink(worth: number, per: number, n: number): number;
export function jackpot(points: number, carried: number): number;
export function carry(worth: number, got: Map<string, number>): number;
export function tally(lines: { id: string; episode: number; n: number }[], byEpisode?: Map<number, Map<string, number>>): Map<string, number>;
/** C2 part 3: a count's points (right calls or bingo lines at a line's points), never rounded. */
export function counted(n: number, points: number): number;
export function multiply(raw: number, factors: number[]): number;
export function best<T extends { points: number; counted?: boolean }>(lines: T[], n: number): T[];
export function episodeTotal(lines: { points: number; counted?: boolean }[], slots?: { points: number }[]): number;
export function sum(values: number[]): number;
/** C2 part 3: a window's answers combined across the seats (a pot split, only the only one right, by answer or by pick). */
export function split(worth: number, units: Map<string, number>): Map<string, number>;
export function only(worth: number, units: Map<string, number>): Map<string, number>;
export function onlyEach(worth: number, by: Map<string, string[]>): Map<string, number>;
export function add(running: number, x: number): number;
/** C2 part 3: a count's running total through each episode (Weekly Calls', bingo's). */
export function through(byEpisode: Map<number, Map<string, number>>, from: number, to: number): Map<number, Map<string, number>>;
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
/** C2 part 3: an episode of a series worked out as the walk goes (a game of questions'): its totals as who's out so far has them,
 *  and what it cost each who could lose a life. */
export interface WalkNight {
  number: number;
  quiet?: boolean;
  totals: Map<string, number> | ((out: Map<string, number>) => Map<string, number>);
  lives?: (ids: string[], out: Map<string, number>) => Map<string, number>;
}
/** ...and co-op's: the questions the couch lost a life on that night. */
export interface CoopNight extends WalkNight {
  missed: (out: Map<string, number>) => string[];
}
export function livesNight(lives: Map<string, number>, lost: Map<string, number>, o: {
  k: number;
  ids: string[];
  left: string[];
  out: Map<string, number>;
  shared: Set<string>;
  allOut: "back" | "share" | "points" | string | null;
}): void;
export function knockouts(series: (SeriesEpisode | WalkNight)[], o: {
  start: number;
  everyone: string[];
  catching: Set<string>;
  startOf: Map<string, number | null>;
  race: { to: number } | null;
  cuts: Cut[];
  oneLeft: "ends" | "plays" | null;
  phaseStarts?: Record<string, number> | null;
  lives?: { of: number; allOut: "back" | "share" | "points" | string | null } | null;
}): { out: Map<string, number>; ends: number | null; lives: Map<string, number> | null; shared: Set<string>; walked: SeriesEpisode[] };
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
export function coop(series: CoopNight[], o: { lives: number }): { lives: number; lost: { episode: number; question: string }[]; ends: number | null; walked: SeriesEpisode[] };
export function total(row: { locked: number; bonus: number; finale: number }, bets: boolean, rounded: boolean): number;
export function compareKeys(a: number[], b: number[]): number;
export function byTotal<T extends { total: number }>(rows: T[]): T[];
export function byKey<T>(rows: T[], key: (row: T) => number[]): T[];
export function standingKey(r: { out?: number | null; total: number; lives?: number | null; shared?: boolean }): number[];
export function recordKey(m: { tier: number; wins: number; ties: number; for: number; seed?: number | null }): number[];
