// Types for episode-facts.js (A13 part 2: facts about an episode research answers, a question settled by one). Only what the
// TypeScript side reads; the shapes are described in the module's own comments.

export type FactId = "titleQuote";
export type FactRating = "reliable" | "usually" | "patchy";

export interface TitleQuoteReport {
  isQuote: "yes" | "no" | "unknown";
  line: string | null;
  by: string | null;
  sure: "high" | "low";
}
export interface EpisodeFactsSection {
  titleQuote: TitleQuoteReport | null;
}

export type FactOutcome =
  | { state: "who"; who: string; name: string }
  | { state: "outside"; name: string }
  | { state: "none" }
  | { state: "unsure"; why: string }
  /** Not sure yet, while research may still settle it (until the episode's final results: pendingUntil). */
  | { state: "pending"; why: string };

/** What our check knows of a fact on a show: the episodes research was asked it on there, and those it said for sure. */
export interface FactEntry {
  asked?: number;
  settled?: number;
}

export const SURE: string[];
export const IS_QUOTE: string[];
export const RELIABILITY: FactRating[];
export const BAR: FactRating[];
export const MEASURED: number;
export const FACTS: Record<FactId, { label: string; takes: Record<string, string[]> }>;
export const FACT_IDS: FactId[];
export function looseEpisodeFacts(v: unknown, repairs?: string[]): EpisodeFactsSection | null;
export function sureOf(f: unknown): boolean;
export function fillFacts(was: unknown, now: unknown): EpisodeFactsSection;
export function pendingUntil(outcome: FactOutcome, finalAt: number | null, now: number, airAt?: number | null): FactOutcome;
export function measuredSeasons(show: string): number[];
export function personIn(cast: { id: string; name: string }[], name: string, loose?: boolean): string | null;
export function outcomeOf(section: EpisodeFactsSection | null, fact: string, cast: { id: string; name: string }[]): FactOutcome | null;
export function measure(items: { section: EpisodeFactsSection | null; cast: { id: string; name: string }[] }[], fact: string): { asked: number; settled: number };
export function entryFor(show: string, fact: string, live?: FactEntry): Required<FactEntry>;
export function ratingOf(entry: FactEntry | undefined): { rating: FactRating | null; asked: number; settled: number };
export function factProblem(fact: string, entry: FactEntry | undefined): string | null;
