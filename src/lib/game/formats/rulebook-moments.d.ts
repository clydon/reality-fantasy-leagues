// Types for formats/rulebook-moments.js: what a rulebook's answers build.
import type { Points, RulebookBlocks } from "./rulebook-schema";

/** A question a moment is known by, or one its condition reads. */
export interface MomentAsk {
  key: string;
  type: "answer" | "integer" | "number" | "string";
  question: string;
  /** What it's called in a condition's own question ("Tribe won the Immunity challenge"). */
  label?: string;
  /** A number's own test, scored once (came 2nd: { equals: 2 }); without it a number scores per unit. */
  when?: { equals: number } | { greaterThan: number };
}

export interface Moment {
  id: string;
  label: string;
  /** Where it comes from; `custom` for a moment added by hand, with its segment or twist when it happens during one. */
  from: { segment?: string; twist?: string; wayOut?: string; finale?: true; custom?: string };
  defaultPoints: Points;
  /** What research asks to know it. Several moments can share one question. */
  ask?: MomentAsk;
  /** Yes-or-no answers that score it too, any one of them (a group's win counted as winning). */
  also?: MomentAsk[];
  /** Answers that must be yes as well (an advantage played). */
  needs?: MomentAsk[];
  /** Answers that mustn't be yes (a group's win that skips the vote; the segment's winners). */
  unless?: MomentAsk[];
  /** Recorded as the episode's exile, and scored from that record. */
  exile?: true;
  /** Known without asking about it: how someone left, a role, other answers. */
  auto?: true;
  custom?: true;
  /** A custom moment scored from a question the rulebook already asks: that question's key (ask.key). */
  uses?: string;
  answeredBy?: "research" | "league";
  reliability?: "reliable" | "usually" | "patchy";
  /** Only with includeOff: built, but switched off. */
  off?: true;
}

export const WAY_POINTS: Record<string, number>;
export function momentsFor(blocks: RulebookBlocks, opts?: { includeOff?: boolean }): Moment[];
export function questionFor(
  moment: { label: string; question?: string; counted?: "yesNo" | "eachTime" | "perUnit"; where?: string | null },
  blocks: RulebookBlocks
): string;
