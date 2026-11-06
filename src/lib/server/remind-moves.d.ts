// Types for remind-moves.js (plain CommonJS so a unit test can require it under bare node).
import type { PushMessage } from "./push-core";

/** A move still open for someone, as due-moves.ts lists it: in which game, and what to do. */
export interface OpenMove {
  leagueId: string;
  leagueName: string;
  text: string;
  href: string;
  episode?: number;
}

/** How long after a reminder from here the same person isn't reminded from here again (ms). */
export const COOLDOWN: number;
/** reminder_log.kind for the commissioner's own reminders. */
export const KIND: string;
/** "in about 3 hours". */
export function whenText(airAt: Date, now: Date): string;
/** Who hears (due) and who already did inside the cooldown (skipped); the actor and anyone with nothing open are neither. */
export function splitDue(moves: Map<string, OpenMove[]>, recent: Set<string>, actor: string): { due: string[]; skipped: string[] };
/** One person's push, or null when they have nothing open. */
export function remindMessage(
  moves: OpenMove[],
  season: { id: string; label: string },
  next: { number: number; airAt: string | null } | null,
  byName: string,
  now?: Date
): PushMessage | null;
