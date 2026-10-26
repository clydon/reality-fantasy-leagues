// Types for push-core.js (plain CommonJS so the hourly jobs can require it too).
import type { Pool } from "pg";
import type { ChatMode } from "@/lib/moments";

export type NotificationType =
  | "draftTurn"
  | "waivers"
  | "waiverReminder"
  | "reminder"
  | "resultsDue"
  | "episodeResults"
  | "finalScores"
  | "newBet"
  | "betResult"
  | "chat"
  | "invite"
  | "memberJoined"
  | "couchJoined"
  | "wikiReview"
  | "gameStarted"
  | "planned"
  | "planOff"
  | "poll"
  | "bingoLine"
  | "flagSettled";

export interface NotificationTypeDef {
  id: NotificationType;
  label: string;
  description: string;
  /** What the Account settings "Test" button sends for this type. */
  sample: { title: string; body: string };
}

/** Someone a notice is for: what decides their words (the guard is the caller's) and where it opens. */
export interface PushReader {
  userId: string;
  ui: "classic" | "new";
  /** Their phone's time zone (user_settings.tz), else null: say a time in the season's own zone. */
  tz: string | null;
  /** Couch chat: every message, quiet on episode nights, or never. */
  chat: ChatMode;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping it goes in classic. Defaults to "/". */
  url?: string;
  /** Where tapping it goes in the new design (and the bell's row). Defaults to "/home". */
  next?: string;
  /** Collapses repeats on the device; defaults to the type. */
  tag?: string;
  /** Once per person: a notice whose key someone already has isn't kept or pushed again. */
  key?: string;
  /** The season it's about (the bell's art; a show's own switches). */
  seasonId?: string | null;
  /** The episode whose results the words give away, and the words for someone not past it (the bell reads rows back through
   *  the guard). */
  spoils?: number | null;
  safe?: { title: string; body: string } | null;
  /** Any of these types being on is enough to push it. */
  anyOf?: NotificationType[];
}

export type PushWords = PushMessage | ((reader: PushReader) => PushMessage | null | Promise<PushMessage | null>);

export const NOTIFICATION_TYPES: NotificationTypeDef[];
export function momentOf(type: string): string | null;
/** A loopback push service in development (scripts/dev-test/fake-push.js); never in production. */
export function loopback(endpoint: string): boolean;

/**
 * Never throws. Call it after the real write has committed (via push-targets.ts's notifyAfter). Takes the POOL, not a
 * transaction client: it sends to devices in parallel, and a single client can't run concurrent queries.
 */
export function sendPush(
  pool: Pool,
  userIds: (string | null | undefined)[],
  type: NotificationType,
  message: PushWords,
  opts?: { ignorePrefs?: boolean; seasonId?: string | null; bell?: boolean }
): Promise<{ sent: number; removed: number; kept: number }>;
