// Types for waivers.js (plain CommonJS so the hourly job can require it too).
import type { Pool, PoolClient } from "pg";
import type { LeagueState, WaiverClaim, WaiverPeriod } from "@/lib/game/types";

export interface WaiverEvent {
  type: "opened" | "cancelled" | "processed" | "closed";
  periodId: string;
  episode: number;
}

/**
 * One player's own claim for a week, or null. Only ever call it for the asking player. Pass the league
 * so a row saved before pairs existed comes back with them worked out.
 */
export function readOwnClaim(db: Pool | PoolClient, leagueId: string, periodId: string, playerId: string, state?: LeagueState): Promise<WaiverClaim | null>;
/** Saves (empty: withdraws) a claim for the open week and republishes who has claims in. */
export function saveClaim(
  client: PoolClient,
  leagueId: string,
  state: LeagueState,
  playerId: string,
  input: unknown,
  userId: string | null
): Promise<{ claim: WaiverClaim; error?: undefined } | { error: string; claim?: undefined }>;
/** A game at your own pace with exclusive teams: the league as it stood at the episode everyone has reached; null otherwise. */
export function pacedCopy(state: LeagueState): LeagueState | null;
/** Runs every waiver step due at `now` (ms; default the clock). */
export function syncWaivers(client: PoolClient, leagueId: string, state: LeagueState, now?: number): Promise<WaiverEvent[]>;
/** The commissioner's Process now: a reason on refusal, else null. At its own pace with exclusive teams it runs the week at
 *  everyone's episode (as openWindow, undoRun and currentWeek read it: BACKLOG 56). */
export function processNow(client: PoolClient, leagueId: string, state: LeagueState, now?: number): Promise<string | null>;
/** The commissioner's Undo last waiver run (WaiverLogic.undo): a reason on refusal, else null. */
export function undoRun(state: LeagueState): string | null;
/** The week whoever runs the game sees as the current one, or null. */
export function currentWeek(state: LeagueState): WaiverPeriod | null;
/** The commissioner's Open a waiver window (`swaps` each; null turns it off), trimming claims that no longer fit. */
export function openWindow(
  client: PoolClient,
  leagueId: string,
  state: LeagueState,
  swaps: number | null,
  now?: number,
  opts?: { replace?: boolean }
): Promise<{ period: WaiverPeriod; trimmed: string[]; error?: undefined } | { error: string; period?: undefined; trimmed?: undefined }>;
