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
  /** Their phone's time zone (user_settings.tz), else null. */
  tz?: string | null;
}

/** The league's season (null when it isn't in the catalog) and its time zone (America/New_York when it has none). */
export function seasonOf(db: Db, state: LeagueState): Promise<{ id: string | null; tz: string }>;
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
): Promise<{ userIds: string[]; message: PushMessage; seasonId: string | null } | null>;
/** The running week as a window before the commissioner's change, or null when none is open. */
export interface WindowSnapshot {
  id: string;
  line: string;
  processAt: string | null;
}
export function windowSnapshot(state: LeagueState): WindowSnapshot | null;
/** "Waiver window open" / "Your claim changed" / "Waiver window off", one message per member it's for. */
export function windowMessages(
  state: LeagueState,
  before: WindowSnapshot | null,
  period: WaiverPeriod,
  leagueName: string,
  people: WaiverMember[],
  trimmed: string[],
  tz: string,
  opts?: { actorUserId?: string | null }
): { userId: string; message: PushMessage }[];
/** Sends windowMessages after a commissioner's Open a waiver window. Never throws; resolves to how many were sent. */
export function sendWindow(
  db: Db,
  leagueId: string,
  state: LeagueState,
  before: WindowSnapshot | null,
  periodId: string,
  trimmed: string[],
  opts?: { actorUserId?: string | null; dry?: boolean; log?: (line: string) => void }
): Promise<number>;
/** " Waivers process Tue 8:00 PM EDT." when episode n's results opened this week, else "": in `tz` (the reader's) when given. */
export function resultsLine(db: Db, state: LeagueState, n: number, tz?: string | null): Promise<string>;
export const REMIND_BEFORE: number;
