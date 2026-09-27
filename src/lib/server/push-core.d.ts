// Types for push-core.js (plain CommonJS so db/wiki-sync.js can require it too).
import type { Pool } from "pg";

export type NotificationType =
  | "draftTurn"
  | "midSeasonTurn"
  | "episodeResults"
  | "newBet"
  | "betResult"
  | "chat"
  | "invite"
  | "memberJoined"
  | "wikiReview";

export interface NotificationTypeDef {
  id: NotificationType;
  label: string;
  description: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping the notification goes. Defaults to "/". */
  url?: string;
  /** Collapses repeats on the device; defaults to the type. */
  tag?: string;
}

export const NOTIFICATION_TYPES: NotificationTypeDef[];

/**
 * Never throws. Call it after the real write has committed (via push-targets.ts's notifyAfter).
 * Takes the POOL, not a transaction client: it sends to devices in parallel, and a single client
 * can't run concurrent queries.
 */
export function sendPush(
  pool: Pool,
  userIds: (string | null | undefined)[],
  type: NotificationType,
  message: PushMessage,
  opts?: { ignorePrefs?: boolean }
): Promise<{ sent: number; removed: number }>;
