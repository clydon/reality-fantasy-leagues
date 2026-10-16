// Types for waivers.js (plain CommonJS so the hourly job can require it too).
import type { Pool, PoolClient } from "pg";
import type { LeagueState, WaiverClaim } from "@/lib/game/types";

export interface WaiverEvent {
  type: "opened" | "cancelled" | "processed" | "closed";
  periodId: string;
  episode: number;
}

/** One player's own claim for a week, or null. Only ever call it for the asking player. */
export function readOwnClaim(db: Pool | PoolClient, leagueId: string, periodId: string, playerId: string): Promise<WaiverClaim | null>;
/** Saves (empty: withdraws) a claim for the open week and republishes who has claims in. */
export function saveClaim(
  client: PoolClient,
  leagueId: string,
  state: LeagueState,
  playerId: string,
  input: unknown,
  userId: string | null
): Promise<{ claim: WaiverClaim; error?: undefined } | { error: string; claim?: undefined }>;
/** Runs every waiver step due at `now` (ms; default the clock). */
export function syncWaivers(client: PoolClient, leagueId: string, state: LeagueState, now?: number): Promise<WaiverEvent[]>;
/** The commissioner's Process now: a reason on refusal, else null. */
export function processNow(client: PoolClient, leagueId: string, state: LeagueState, now?: number): Promise<string | null>;
