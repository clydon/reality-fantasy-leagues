import type { Pool } from "pg";

/** A league as the check found it: what syncLeagueRulebook would write, and whether it scores the same with it. */
export interface CheckedLeague {
  id: string;
  slug: string;
  name: string;
  /** Deleted (restorable): the switch walks it too. */
  deleted: boolean;
  written: boolean;
  source?: "own" | "season";
  version?: number;
  same?: boolean;
  rules?: boolean;
  differs?: string[];
  mismatch?: string;
  reason?: string;
}

export interface CheckedSeason {
  id: string;
  season: string;
  ruled: boolean;
  same: boolean;
}

/** The read-only check: every league and season, each in a rolled-back transaction. */
export function check(
  pool: Pool,
  o?: { log?: (line: string) => void; progress?: ((done: number, total: number) => unknown) | null }
): Promise<{ leagues: CheckedLeague[]; seasons: CheckedSeason[]; ok: boolean }>;

/** The flag on (after the backfill, which throws with `seasons` when one isn't its format) or off, then every league. */
export function flip(pool: Pool, on: boolean, o?: { log?: (line: string) => void }): Promise<{ written: number; removed: number; unchanged: number; stayed: string[] }>;

export function status(pool: Pool, o?: { log?: (line: string) => void }): Promise<{ on: boolean; leagues: number; carrying: number; behind: number }>;

export function scoringSnapshot(state: unknown, o?: { sets?: boolean }): Record<string, unknown>;
export function comparePlayed(state: unknown, o?: { phaseStarts?: Record<string, number> }): { same: boolean; rules: boolean; differs: string[] };
