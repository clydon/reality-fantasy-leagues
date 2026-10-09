// Types for formats/ruleset-review.js.
import type { FormatData } from "./index";
import type { ReviewNote } from "./proposal";

export interface RulesetReviewEvent {
  id: string;
  label: string;
  /** Awarded by an exit rule, so it follows the recorded exit and can't be added by hand. */
  implied: boolean;
  rules: { at: string; sentence: string }[];
  problems: string[];
}

export interface RulesetReview {
  problems: ReviewNote[];
  approvable: boolean;
  categories: { label: string; events: RulesetReviewEvent[] }[];
  otherRules: { at: string; sentence: string; problems: string[] }[];
  questions: { key: string; type: string; values?: string[] }[];
  exitMethods: string[];
  categoryOptions: string[];
  leftoverProblems: ReviewNote[];
}

export function reviewRuleset(data: FormatData): RulesetReview;
