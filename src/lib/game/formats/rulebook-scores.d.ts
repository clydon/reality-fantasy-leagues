// Types for formats/rulebook-scores.js: the What scores question, its answer, and the review.
import type { BlocksProblem, RulebookBlocks } from "./rulebook-schema";

export interface Rung {
  id: string;
  points: number;
  test: string;
}
/** The ladder, top rung first. */
export const LADDER: Rung[];
/** How often a moment comes up across a season: what a moment on earned or above gains on top of its rung. */
export const RARITY: { id: string; bump: number; test: string }[];
/** The least a rung is worth for rarity to count. */
export const RARITY_FROM: number;
export const PER_UNIT: { id: "perUnit"; min: number; max: number };
export const KNOWN: ["pastSeasons", "thisSeason"];

export interface ScoresRow {
  id: string;
  label: string;
  before: number;
  /** What it's worth now, in words ("3 (5 when shared)"). */
  beforeWord: string;
  after: number;
  /** The rung it stands on, or null when the answer didn't score it. */
  rung: string | null;
  /** How often it comes up (null for perUnit, or when not scored). */
  rarity: string | null;
  why: string;
  changed: boolean;
}
export interface ScoresAdded {
  id: string;
  label: string;
  points: number;
  rung: string;
  rarity: string | null;
  why: string;
  /** The show's own repertoire (never a spoiler), or this season's. */
  known: "pastSeasons" | "thisSeason";
  /** The first episode of the season it could happen in. */
  firstEpisode: number;
  counted: string;
  answeredBy: string;
  during: { segment: string } | { twist: string } | null;
}
export interface ScoresReview {
  /** The blocks with the points and added moments applied (never what's held). */
  blocks: RulebookBlocks;
  rows: ScoresRow[];
  added: ScoresAdded[];
  /** Adds left out, and why (a repeat, a name, no rung). */
  skipped: { label: string; why: string }[];
  /** Ids of this season's added moments past the reader's mark: kept open, never shown. */
  held: string[];
  problems: BlocksProblem[];
  warnings: BlocksProblem[];
  leftOut: string[];
  lines: string[];
  changes: number;
}

export function buildScoresPrompt(opts: { show: string; season?: string; airing?: boolean; aired?: number; episodeCount?: number | null; blocks: RulebookBlocks }): string;
export function parseScoresAnswer(answer: string): Record<string, unknown>;
/** `mark`: where the reader is (0, null or Infinity: nothing held); `settled`: ids used or put away, left out. */
export function reviewScores(answer: unknown, blocks: RulebookBlocks, opts?: { castNames?: string[]; mark?: number | null; episodeCount?: number | null; settled?: Record<string, string> }): ScoresReview;
/** The review's changes with `declined` ids (moments or added moments) left out, applied to `blocks`. */
export function pickScores(blocks: RulebookBlocks, review: Pick<ScoresReview, "rows" | "added" | "blocks">, declined?: string[]): RulebookBlocks;
