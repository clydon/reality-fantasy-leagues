// Types for the part of bot-research.js the Next app calls (the cron tick and the admin season routes).
import type { Pool } from "pg";

/** quick: who left and the headline; full: every result, staged for review; schedule: when the next episode airs
 *  and how long it runs (season_episodes), nothing to review. */
export type BotKind = "quick" | "full" | "schedule";
export interface BotScheduleRun {
  kind: BotKind;
  /** Minutes after the episode ends (its air time plus the season's episode length). */
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
/** What the quick check's prompt reads of a research context (episode-research.js resolveResearchContext). */
export interface QuickContext {
  showName: string;
  season: number;
  episodeNumber: number;
  castNames: string[];
  terms?: { castaways?: string; castaway?: string };
  format?: { exitMethods?: string[] };
}
/** The quick check's question: who left in this episode, and the headline, as a small fixed JSON. Backstage (step 5)
 *  hands it to Ask an AI; the bot asks it on its schedule. */
export function buildQuickPrompt(ctx: QuickContext, airedAt: Date | null, tz: string): string;
/** The quick check's answer, each name matched to `castNames` where it can be. Throws when it isn't JSON. */
export function parseQuickAnswer(text: string, castNames: string[]): QuickAnswer;

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
/** The earliest due run across every season with bot research on, run; or { job: null }. Either way,
 *  `next`: when the next run comes due (now if one already is), or null when none is left. */
export function runNext(
  pool: Pool,
  opts: { ask: Ask; now?: Date; dry?: boolean; seasonId?: string }
): Promise<
  | { job: null; next: Date | null }
  | ({ job: { season: string; seasonNumber: number; episode: number; slot: string; kind: BotKind }; next: Date | null } & BotRunOutcome)
>;
type DueRun = { episode: number; slot: string; kind: BotKind; after: number; at: Date; season: { id: string; slug: string; season_number: number } };
/** What's due now (each with its season row), earliest first. */
export function listDue(pool: Pool, opts?: { now?: Date; seasonId?: string }): Promise<DueRun[]>;
/** What's due now, and when the next run comes due (now if one already is; null when none is left). */
export function planRuns(pool: Pool, opts?: { now?: Date; seasonId?: string }): Promise<{ due: DueRun[]; next: Date | null }>;
/** One run, outside the schedule (an admin's "Run now"). */
export function runJob(
  pool: Pool,
  job: { season: unknown; episode: number; kind: BotKind; slot?: string },
  opts: { ask: Ask; dry?: boolean }
): Promise<BotRunOutcome>;
/** A season row the way runJob wants it (schedule, air clock), or undefined. */
export function loadSeasonForJob(pool: Pool, seasonId: string): Promise<unknown>;
