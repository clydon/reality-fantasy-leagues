// Types for formats/rulebook-research.js: the rulebook research prompt, its answer, and the review.
import type { BlocksProblem, RulebookBlocks } from "./rulebook-schema";

export interface RulebookReview {
  /** The answer as blocks, tidied (ids, references by name, answers that don't apply, repeats left out). */
  blocks: RulebookBlocks;
  /** When phases actually started, by phase id: season data for a person to confirm, never part of the blocks. */
  phaseStarts: Record<string, number>;
  /** Located problems, a cast member's name among them; the row stays, so it can be fixed. */
  problems: BlocksProblem[];
  /** What the review tidied, and what looks off (a sentence about an episode, a segment with no way out). */
  warnings: BlocksProblem[];
  leftOut: string[];
  approvable: boolean;
}

/** `change`: something one episode brought that the rulebook may not have (research's note): only that is added to `template`. */
export function buildRulebookPrompt(opts: { show: string; season?: string; airing?: boolean; template?: RulebookBlocks | null; change?: { episode: number; note: string } }): string;
export function parseRulebookAnswer(answer: string): Record<string, unknown>;
/** Every top-level JSON object in a text, in order (braces counted outside strings). */
export function jsonObjectsIn(text: string): string[];
/** `keep`: the labels of custom moments the rulebook being checked already has (never left out as a repeat). */
export function reviewRulebook(answer: unknown, opts?: { castNames?: string[]; keep?: string[] }): RulebookReview;
