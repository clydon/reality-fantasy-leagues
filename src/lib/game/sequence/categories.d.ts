// Types for the scoring sequence's pieces for a game ranked by a sport's categories (./categories.js, docs/PLAN-start-a-game-gpt.md
// track L, L4 part 1b).

/** A rate's parts: weighted counts over weighted counts (ERA: { ER: 27 } over { OUTS: 1 }). */
export interface RateParts {
  top: Record<string, number>;
  bottom: Record<string, number>;
}
/** What a categories game reads of each of a sport's stats (the Sport's categoryDefs): which way is better, its stat group, and a
 *  rate's parts. */
export interface CategoryDef {
  better: "higher" | "lower";
  group: string;
  parts?: RateParts;
}
export type CategoryDefs = Record<string, CategoryDef>;
/** Each category's total: a count's or a derived stat's sum, a rate's value, or null for a rate with nothing to divide by. */
export type CategoryTotals = Record<string, number | null>;

export interface CategoryRecord {
  wins: number;
  losses: number;
  ties: number;
}
export interface CategoryMatchup {
  cats: { stat: string; a: number | null | undefined; b: number | null | undefined; won: "a" | "b" | null }[];
  a: CategoryRecord;
  b: CategoryRecord;
  result: "a" | "b" | "tie";
}
export interface CategoryGame {
  a: string;
  b: string | null;
  matchup: CategoryMatchup | null;
}
export interface CategoryWeek {
  quiet: boolean;
  games: CategoryGame[];
}
export interface RotoRow {
  id: string;
  points: Record<string, number>;
  total: number;
}

export function weigh(counts: Record<string, number>, weights: Record<string, number>): number;
export function rateOf(parts: RateParts, counts: Record<string, number>): number | null;
export function categoryTotals(lines: Record<string, number>[], cats: string[], defs: CategoryDefs): CategoryTotals;
export function windowLines(byEpisode: Record<number, Record<string, Record<string, number>>> | null | undefined, from: number, to: number, heldAt: (episode: number) => string[] | null | undefined): Record<string, number>[];
export function compareCategory(a: number | null | undefined, b: number | null | undefined, better: "higher" | "lower"): -1 | 0 | 1;
export function categoryMatchup(a: CategoryTotals, b: CategoryTotals, cats: string[], defs: CategoryDefs): CategoryMatchup;
export function categoryWeek(totals: Map<string, CategoryTotals>, seats: string[], r: number, cats: string[], defs: CategoryDefs, o?: { odd?: "median" | "bye"; quiet?: "skip" | "tie" }): CategoryWeek;
export function categoryRecords(weeks: CategoryWeek[], by: "categories" | "matchups"): Map<string, CategoryRecord>;
export function roto(totals: Map<string, CategoryTotals>, cats: string[], defs: CategoryDefs): RotoRow[];
/** L3 part 2d: head to head on categories over a game, in the sequence's matchups' shape (state-logic.js MatchupLogic's walk). */
export function categoryMatchups(
  played: { number: number; totals: Map<string, CategoryTotals> }[],
  o: {
    parts: { by: "categories" | "matchups" | "roto"; categories: string[]; odd: "median" | "bye" | null; quiet: "skip" | "tie" | null; playoffs: { teams: number; rounds: number; from: number | null } | null };
    defs: CategoryDefs;
    start: number;
    from: number | null;
    finale: number | null;
    ended?: boolean;
    seatsAt: (k: number) => string[];
  }
): {
  weeks: { number: number; quiet: boolean; games: { a: string; b: string | null; aPoints: number | null; bPoints: number | null; result: "a" | "b" | "tie" | null; cats: CategoryMatchup["cats"] | null }[] }[];
  records: Map<string, CategoryRecord & { for: number; against: number }>;
  from: number | null;
  seeds: string[] | null;
  rounds: { number: number; played: boolean; games: { a: string | null; b: string | null; aSeed: number | null; bSeed: number | null; aPoints: number | null; bPoints: number | null; winner: string | null; cats?: CategoryMatchup["cats"] }[] }[];
  alive: Set<string>;
  champion: string | null;
  tiers: Map<string, number>;
};
