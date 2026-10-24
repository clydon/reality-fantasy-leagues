// Types for the part of bot-research.js the Next app calls (the cron tick and the admin season routes).
import type { Pool } from "pg";

export type BotKind = "quick" | "full";
export interface BotScheduleRun {
  kind: BotKind;
  /** Minutes after the episode airs. */
  after: number;
  on: boolean;
}
export interface QuickAnswer {
  found: boolean;
  episodeTitle: string | null;
  left: { name: string; how: string | null; matched: boolean }[];
  headline: string | null;
  sources: string[];
}
export interface BotRunOutcome {
  ok: boolean;
  message: string;
  result: Record<string, unknown> | null;
  seconds: number;
  runId: string | null;
}
type Ask = (prompt: string) => Promise<{ answer: string }>;

export const DEFAULT_SCHEDULE: BotScheduleRun[];
export const MAX_ATTEMPTS: number;
/** A schedule from a request body, cleaned up; throws (with a message for the admin) if malformed. */
export function normalizeSchedule(input: unknown): BotScheduleRun[];
export function slotOf(run: { kind: BotKind; after: number }): string;
/** The earliest due run across every season with bot research on, run; or { job: null }. */
export function runNext(
  pool: Pool,
  opts: { ask: Ask; now?: Date; dry?: boolean; seasonId?: string }
): Promise<{ job: null } | ({ job: { season: string; seasonNumber: number; episode: number; slot: string; kind: BotKind } } & BotRunOutcome)>;
/** What's due now (each with its season row), earliest first. */
export function listDue(
  pool: Pool,
  opts?: { now?: Date; seasonId?: string }
): Promise<{ episode: number; slot: string; kind: BotKind; after: number; at: Date; season: { id: string; slug: string; season_number: number } }[]>;
/** One run, outside the schedule (an admin's "Run now"). */
export function runJob(
  pool: Pool,
  job: { season: unknown; episode: number; kind: BotKind; slot?: string },
  opts: { ask: Ask; dry?: boolean }
): Promise<BotRunOutcome>;
/** A season row the way runJob wants it (schedule, air clock), or undefined. */
export function loadSeasonForJob(pool: Pool, seasonId: string): Promise<unknown>;
