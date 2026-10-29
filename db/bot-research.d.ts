// Types for the part of bot-research.js the Next app calls (the cron tick and the admin season routes).
import type { Pool } from "pg";

/** quick: who left and the headline; full: every result, staged for review; schedule: when the next episode airs
 *  and how long it runs (season_episodes), nothing to review; trivia: questions about it and the season so far, checked
 *  (trivia_questions, 0140); bingo: the squares for the episode coming up, checked (bingo_squares, 0146). */
export type BotKind = "quick" | "full" | "schedule" | "trivia" | "bingo";
/** A run row's kind: a schedule's, or a tie-break (the full research again, when a result's been disputed a day; the
 *  desk's switch) or a rulebook check (a show change the couches confirmed). */
export type RunKind = BotKind | "tiebreak" | "rulebook";
export interface BotScheduleRun {
  kind: BotKind;
  /** Minutes after the episode ends (its air time plus the season's episode length); trivia's, before the next one airs;
   *  bingo's, before this one airs. */
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

/** An asked episode's run that ended its ask (it worked, or was its last try): whoever asked, to tell. */
export interface SettledAsk {
  userId: string | null;
  askedAt: Date;
  ok: boolean;
  /** How many results reached the season (when it worked). */
  found: number | null;
  message: string | null;
}
export interface BotRunOutcome {
  ok: boolean;
  message: string;
  result: Record<string, unknown> | null;
  seconds: number;
  runId: string | null;
  /** An asked episode's run (slot ASKED_SLOT) that ended its ask. */
  asked?: SettledAsk;
}
/** How far an answer has got, as the bot streams it (src/lib/server/ask-bot.ts BotProgress). */
type AskProgress = { stage: "waiting" | "opening" | "sending" | "asking" | "writing"; chars: number; matches?: number };
/** `budgetMs`: how long this ask may take (a trivia run's two share the route's budget). `progress`: hear how the answer is
 *  going (`pattern` counted in what's written so far); a stand-in may ignore it. */
type Ask = (prompt: string, o?: { budgetMs?: number; progress?: { pattern?: string | null; on: (p: AskProgress) => void } }) => Promise<{ answer: string }>;
/** Files the bot's answers as sources (src/lib/server/bot-results.ts, docs/PLAN-new-design.md step 6c). */
export interface BotSend {
  /** Who went home: sent when it can be trusted on its own, else kept for a commissioner (`applied: false`). */
  quick(input: { seasonId: string; episode: number; answer: QuickAnswer; castNames: string[]; exitMethods: string[] }): Promise<
    { applied: true; leagues: number; researchId: string } | { applied: false; doubt: string; line: string }
  >;
  /** The full results (researchFromPaste's run): sent as one source, the scheduled runs' (autopilot) or a tie-break's. */
  /** `replaces`: the answer carries everything the bot said about the episode before (asked again, merged): its earlier ones
   *  stop counting. */
  full(input: { seasonId: string; episode: number; run: unknown; source: "autopilot" | "tiebreak"; replaces?: boolean }): Promise<{ researchId: string; facts: number; count: number }>;
}

export const DEFAULT_SCHEDULE: BotScheduleRun[];
export const MAX_ATTEMPTS: number;
/** A schedule from a request body, cleaned up; throws (with a message for the admin) if malformed. */
export function normalizeSchedule(input: unknown): BotScheduleRun[];
export function slotOf(run: { kind: BotKind; after: number }): string;
/** The earliest due run across every season with bot research on, run; or { job: null }. Either way,
 *  `next`: when the next run comes due (now if one already is), or null when none is left. */
export function runNext(
  pool: Pool,
  opts: { ask: Ask; send?: BotSend; now?: Date; dry?: boolean; seasonId?: string }
): Promise<
  | { job: null; next: Date | null }
  | ({ job: { season: string; seasonNumber: number; seasonId: string; episode: number; slot: string; kind: RunKind }; next: Date | null } & BotRunOutcome)
>;
/** `forSeason`: a bingo job for the season's own bank (slot SEASON_BINGO_SLOT). */
type DueRun = { episode: number; slot: string; kind: RunKind; after: number | null; at: Date; forSeason?: boolean; season: { id: string; slug: string; season_number: number } };
/** The slot of a season's own bingo bank's scheduled job. */
export const SEASON_BINGO_SLOT: string;
/** What's due now (each with its season row), earliest first. */
export function listDue(pool: Pool, opts?: { now?: Date; seasonId?: string }): Promise<DueRun[]>;
/** What's due now, and when the next run comes due (now if one already is; null when none is left). */
export function planRuns(pool: Pool, opts?: { now?: Date; seasonId?: string }): Promise<{ due: DueRun[]; next: Date | null }>;
/** One run, outside the schedule (an admin's "Run now"). */
export function runJob(
  pool: Pool,
  job: { season: unknown; episode: number; kind: BotKind; slot?: string; forSeason?: boolean },
  opts: { ask: Ask; send?: BotSend; dry?: boolean }
): Promise<BotRunOutcome>;
/** A season row the way runJob wants it (schedule, air clock), or undefined. */
export function loadSeasonForJob(pool: Pool, seasonId: string): Promise<unknown>;

/** An asked episode's run rows carry this slot (db/migrations/0152); two tries each. */
export const ASKED_SLOT: string;
export const ASKED_TRIES: number;
type RunTry = { started_at: Date | string; ok: boolean | null };
/** One season's next asked run (each episode's full results in order), a hold, or null. */
export function seasonAskNext(
  asks: { episode_number: number; asked_at: Date | string; tries: RunTry[] }[],
  now: Date
): { episode: number; kind: "full"; slot: string; at: Date } | { hold: Date } | null;
/** A run still marked running after this long was cut off: it counts as a failed try. */
export const RUNNING_STALE_MS: number;
/** When an asked episode's next try may start (its runs since it was asked), or null for never. */
export function askedNext(askedAt: Date, tries: { started_at: Date | string; ok: boolean | null }[], now: Date): Date | null;
/** The asked episodes due now (one at a time per season, in order) and when the next comes due. */
export function planAsks(pool: Pool, now: Date, seasonId?: string | null): Promise<{ due: DueRun[]; next: Date | null }>;

/** How long a result stays disputed before its tie-break run. */
export const TIEBREAK_AFTER_MS: number;
export interface TiebreakQuestion {
  seasonId: string;
  episode: number;
  flags: Date[];
  disputed: boolean;
  newest: Date | null;
  tries: { started_at: Date; ok: boolean | null }[];
}
/** When an episode's tie-break comes due (`next`: its next try), or null when it has none to come. */
export function tiebreakNext(q: Omit<TiebreakQuestion, "seasonId" | "episode">): { since: Date; due: Date; next: Date } | null;
/** Whether the desk's tie-break switch is on. */
export function tiebreakOn(pool: Pool): Promise<boolean>;
/** Every episode with a question open on a shared result (or one season's), with its tie-break history. */
export function tiebreakQuestions(pool: Pool, seasonId?: string | null): Promise<TiebreakQuestion[]>;

// The desk's Research and the bot (docs/PLAN-desk-parity.md part 4a) draws the next episode's night from these.
/** When one run of an episode is due (ms in, Date out): from its end, trivia's back from the next one, bingo's back from its
 *  start; null when it never is. */
export function dueAt(run: { kind: BotKind; after: number }, ends: number, nextAt: Date | null, starts?: number | null): Date | null;
/** When each episode of a season (loadSeasonForJob's) airs, and its own length when research confirmed it. */
export function episodeAirTimes(season: unknown): { episode: number; at: Date; minutes?: number }[];
/** How long a season's episodes run, in minutes: its own setting, else an hour. */
export function episodeMinutesOf(season: unknown): number;
export const DEFAULT_EPISODE_MINUTES: number;
/** A trivia run waits at least this long (minutes) after its episode ends. */
export const TRIVIA_AFTER_END: number;
/** The schedule check's question: when the next episode airs, and how long it runs. */
export function buildSchedulePrompt(showName: string, season: number, episode: number, airedAt: Date | null, tz: string): string;
