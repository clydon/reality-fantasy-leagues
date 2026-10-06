// Types for formats/season-check.js: the "Check for rule changes" review model
// (docs/PLAN-season-rule-changes.md). The screen edits a SeasonCheck; everything else is derived.
import type { FormatData, SeasonChangeDelta } from "./index";
import type { ReviewNote } from "./proposal";

/** The chat's answer, as stored and edited. Loose on purpose: it's checked row by row. */
export interface SeasonCheck {
  changed?: boolean;
  summary?: string;
  effectiveEpisode?: number | null;
  checkedThrough?: number | null;
  exitMethods?: { name: string; kind?: "out" | "finalist"; meaning?: string }[];
  questions?: { key: string; type: string; values?: string[]; question: string; note?: string; tier?: string; where?: string }[];
  events?: { id: string; label: string; category?: string; points: number | string; tier?: string; why?: string }[];
  rules?: { research?: unknown[]; implied?: unknown[] };
  retire?: { event: string; why?: string }[];
  notTrackable?: { fact: string; why?: string }[];
  flagged?: { name: string; what?: string; whyCode?: string; findings?: string }[];
  sources?: string[];
  [key: string]: unknown;
}

export interface SeasonCheckEvent {
  id: string;
  label: string;
  /** The category's label; `categoryId` is an existing category's id, or the new one's. */
  category: string;
  categoryId: string;
  newCategory: boolean;
  points: number;
  tier: "A" | "B" | "C" | null;
  why: string;
  implied: boolean;
  rules: { at: string; sentence: string }[];
  problems: string[];
  warnings: string[];
}

export interface SeasonCheckReview {
  /** False for "nothing changed" (recorded as no_change, never approved). */
  changed: boolean;
  summary: string;
  effectiveEpisode: number | null;
  checkedThrough: number | null;
  /** The change, built from every usable row (every key present). Approval stores it. */
  delta: Required<SeasonChangeDelta> & { addRules: { research: unknown[]; implied: unknown[] } };
  approvable: boolean;
  problems: ReviewNote[];
  warnings: ReviewNote[];
  repairs: ReviewNote[];
  /** What merging into the season's rules left out, and why (each also a problem). */
  skipped: { change: string; what: string; why: string }[];
  exits: { name: string; kind: "out" | "finalist"; meaning: string; warnings: string[] }[];
  questions: {
    key: string; type: string; values?: string[]; question: string; note: string; tier: "A" | "B" | "C" | null; where: string;
    problems: string[]; warnings: string[];
  }[];
  events: SeasonCheckEvent[];
  otherRules: { at: string; sentence: string }[];
  retire: { event: string; why: string; problems: string[] }[];
  notTrackable: { fact: string; why: string }[];
  flagged: { name: string; what: string; whyCode: string; findings: string }[];
  sources: string[];
}

export const CHECK_SHAPE: Record<string, unknown>;
export function buildCheckPrompt(opts: {
  showName?: string;
  seasonLabel?: string;
  wikiUrl?: string | null;
  data: FormatData;
  airedThrough?: number | null;
  approved?: { effectiveEpisode: number; summary?: string }[];
  flags?: { episode: number; note: string }[];
}): string;
export function parseCheck(answer: string): SeasonCheck;
export function reviewCheck(answer: SeasonCheck, base: FormatData, opts?: { effectiveEpisode?: number | null }): SeasonCheckReview;
