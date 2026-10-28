// The sports (docs/PLAN-start-a-game-gpt.md track L): one class per sport, found by ESPN's sport slug, the first half of a
// league's path ("baseball" of "baseball/mlb", and of "baseball/college-baseball"). Football, basketball and hockey join in
// L1's next part; soccer, golf, racing, MMA and tennis in L5.
import { Baseball } from "./baseball";
import baseballDefaults from "./defaults/baseball.json";
import type { LockCadence, TeamSport } from "./sport";

export * from "./sport";
export { Baseball } from "./baseball";

const SPORTS: TeamSport[] = [new Baseball()];

/** The sport by its id ("baseball"), or null for one not built yet. */
export function sportById(id: string): TeamSport | null {
  return SPORTS.find((s) => s.id === id) ?? null;
}

/** The sport an ESPN league plays ("baseball/mlb" is Baseball), or null for one not built yet. */
export function sportOf(league: string): TeamSport | null {
  return sportById(String(league).split("/")[0]);
}

/** Every sport built so far. */
export function allSports(): TeamSport[] {
  return [...SPORTS];
}

/** A lineup slot in a sport's defaults: how many, and which positions or position groups fill it. */
export interface DefaultSlot {
  slot: string;
  n: number;
  takes: string[];
}

/**
 * A sport's defaults, stored as data (./defaults/<sport>.json): its standard scoring (stat key to points), its categories, its
 * lineup slots and how often lineups lock, and the game specs its Make it a game starts from (`season`, `short`). The specs
 * are in the game spec's shape (docs/PLAN-start-a-game-gpt.md, "The game spec"); nothing in code knows their numbers.
 */
export interface SportDefaults {
  sport: string;
  about: string;
  scoring: { source: string; points: Record<string, number> };
  categories: { source: string; stats: string[] };
  slots: { source: string; lineup: DefaultSlot[]; bench: number };
  closes: LockCadence;
  specs: Record<string, { about: string; spec: Record<string, unknown> }>;
}

const DEFAULTS: Record<string, SportDefaults> = { baseball: baseballDefaults as SportDefaults };

/** A sport's defaults, or null for one that has none yet. */
export function defaultsFor(sportId: string): SportDefaults | null {
  return DEFAULTS[sportId] ?? null;
}
