// Types for formats/proposal.js: the review model the "Research a new show" screen renders
// (docs/PLAN-stage-3-format-proposals.md). The screen edits a Proposal; everything else is derived.
import type { FormatData } from "./index";

/** The chat's answer, as stored and edited. Loose on purpose: a chat's answer is checked row by row. */
export interface Proposal {
  show?: { name?: string; castawayTerm?: string; tribeTerm?: string; hasMerge?: boolean; hasGroups?: boolean };
  seasonsChecked?: string[];
  exitMethods?: { name: string; kind?: "out" | "finalist" | "winner"; meaning?: string }[];
  questions?: { key: string; type: string; values?: string[]; question: string; note?: string; tier?: string; where?: string }[];
  events?: { id: string; label: string; category?: string; points: number | string; tier?: string; why?: string; headline?: boolean }[];
  rules?: { research?: unknown[]; implied?: unknown[] };
  notTrackable?: { fact: string; why?: string }[];
  flagged?: { name: string; what?: string; whyCode?: string; findings?: string }[];
  domains?: { domain: string; why?: string }[];
  sources?: string[];
  [key: string]: unknown;
}

/** A problem, warning or repair: `at` names a row (`events[id]`, `questions[key]`, `exits[name]`,
 *  `rules.research[2]`) or `format`. */
export interface ReviewNote {
  at: string;
  message: string;
}

export interface ReviewEvent {
  id: string;
  label: string;
  category: string;
  points: number;
  tier: "A" | "B" | "C" | null;
  why: string;
  headline: boolean;
  /** Awarded by an exit rule, so it follows the recorded exit and can't be added by hand. */
  implied: boolean;
  /** The rules that award it, as sentences. */
  rules: { at: string; sentence: string }[];
  problems: string[];
  warnings: string[];
}

export interface Review {
  id: string;
  /** The format's data half, built from every usable row. Approval stores it. */
  data: FormatData;
  approvable: boolean;
  problems: ReviewNote[];
  warnings: ReviewNote[];
  repairs: ReviewNote[];
  exits: { name: string; kind: "out" | "finalist" | "winner"; meaning: string; added?: boolean; warnings: string[] }[];
  questions: {
    key: string; type: string; values?: string[]; question: string; note: string; tier: "A" | "B" | "C" | null; where: string;
    problems: string[]; warnings: string[];
  }[];
  /** Events grouped as League Settings groups them, in first-seen order. */
  categories: { label: string; events: ReviewEvent[] }[];
  /** Rules no event row shows (a stage, or one whose award isn't an event). */
  otherRules: { at: string; sentence: string; problems: string[] }[];
  notTrackable: { fact: string; why: string }[];
  flagged: { name: string; what: string; whyCode: string; findings: string }[];
  /** Suggested research domains; preChecked when it's a site research already trusts. Never auto-applied. */
  domains: { domain: string; why: string; preChecked: boolean }[];
  sources: string[];
  seasonsChecked: string[];
}

export const PROPOSAL_SHAPE: Record<string, unknown>;
export function buildProposalPrompt(opts: { showName?: string; wikiUrl?: string; terms?: { castaway?: string; tribe?: string }; seasons?: string }): string;
export function parseProposal(answer: string): Proposal;
export function reviewProposal(proposal: Proposal, opts?: { id?: string }): Review;
export function formatIdFor(name: string): string;
export function camelId(label: string): string;
/** Every event id a rule awards (its own award, and a built-in's event params). */
export function awardsOf(rule: unknown): string[];
/** A formatProblems() message -> { at, message }, the row it belongs to. */
export function locate(message: string, questionKeys: string[]): ReviewNote;
