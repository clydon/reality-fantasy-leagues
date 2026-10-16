// Types for waiver-pushes.js (plain CommonJS so the hourly job can require it too).
import type { Pool, PoolClient } from "pg";
import type { LeagueState, WaiverPeriod } from "@/lib/game/types";
import type { PushMessage } from "./push-core";

type Db = Pool | PoolClient;

export interface WaiverSnapshot {
  id: string;
  runAt: string | null;
}

/** Someone in the league's waivers with an account; `seen` is how far they've revealed (Infinity: everything). */
export interface WaiverMember {
  userId: string;
  playerId: string;
  seen: number;
}

/** The league's season's time zone (America/New_York when it has none). */
export function seasonTz(db: Db, state: LeagueState): Promise<string>;
/** "Tue 8:00 PM EDT", or "8:00 PM EDT" without the day. */
export function clock(iso: string, tz: string, day?: boolean): string;
/** Where the running week stands, before a mutation. */
export function snapshot(state: LeagueState): WaiverSnapshot | null;
/** The week that processed since `before` and is still in free agency, else null. */
export function justProcessed(before: WaiverSnapshot | null, state: LeagueState): WaiverPeriod | null;
/** "Waivers processed", one message per member it's for. */
export function processedMessages(
  state: LeagueState,
  period: WaiverPeriod,
  leagueName: string,
  people: WaiverMember[]
): { userId: string; message: PushMessage }[];
/** Sends "Waivers processed" for a week. Never throws; resolves to how many were sent. */
export function sendProcessed(
  db: Db,
  leagueId: string,
  state: LeagueState,
  period: WaiverPeriod,
  opts?: { dry?: boolean; log?: (line: string) => void }
): Promise<number>;
/** The reminders six hours before a week processes, once each. Resolves to how many were sent. */
export function remindWaivers(
  db: Db,
  league: { id: string; name: string; state: LeagueState },
  now: number,
  opts?: { dry?: boolean; log?: (line: string) => void }
): Promise<number>;
/** The commissioner's Nudge to one player, or null when they have no account. */
export function nudgeMessage(
  db: Db,
  leagueId: string,
  state: LeagueState,
  playerId: string,
  byName: string
): Promise<{ userIds: string[]; message: PushMessage } | null>;
/** " Waivers process Tue 8:00 PM EDT." when episode n's results opened this week, else "". */
export function resultsLine(db: Db, state: LeagueState, n: number): Promise<string>;
export const REMIND_BEFORE: number;
