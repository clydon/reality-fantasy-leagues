// Types for formats/rulebook-scores.js: the What scores question, its answer, and the review.
import type { BlocksProblem, RulebookBlocks } from "./rulebook-schema";

export interface Rung {
  id: string;
  points: number;
  test: string;
}
/** The ladder, top rung first. */
export const LADDER: Rung[];
export const PER_UNIT: { id: "perUnit"; min: number; max: number };

export interface ScoresRow {
  id: string;
  label: string;
  before: number;
  /** What it's worth now, in words ("3 (5 when shared)"). */
  beforeWord: string;
  after: number;
  /** The rung it stands on, or null when the answer didn't score it. */
  rung: string | null;
  why: string;
  changed: boolean;
}
export interface ScoresAdded {
  id: string;
  label: string;
  points: number;
  rung: string;
  why: string;
  counted: string;
  answeredBy: string;
  during: { segment: string } | { twist: string } | null;
}
export interface ScoresReview {
  /** The blocks with the points and added moments applied. */
  blocks: RulebookBlocks;
  rows: ScoresRow[];
  added: ScoresAdded[];
  /** Adds left out, and why (a repeat, a name, no rung). */
  skipped: { label: string; why: string }[];
  problems: BlocksProblem[];
  warnings: BlocksProblem[];
  leftOut: string[];
  lines: string[];
  changes: number;
}

export function buildScoresPrompt(opts: { show: string; season?: string; airing?: boolean; aired?: number; episodeCount?: number | null; blocks: RulebookBlocks }): string;
export function parseScoresAnswer(answer: string): Record<string, unknown>;
export function reviewScores(answer: unknown, blocks: RulebookBlocks, opts?: { castNames?: string[] }): ScoresReview;
