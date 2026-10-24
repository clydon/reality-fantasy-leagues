// Types for formats/rulebook-moments.js: what a rulebook's answers build.
import type { Points, RulebookBlocks } from "./rulebook-schema";

export interface Moment {
  id: string;
  label: string;
  /** Where it comes from; `custom` for a moment added by hand, with its segment or twist when it happens during one. */
  from: { segment?: string; twist?: string; wayOut?: string; finale?: true; custom?: string };
  defaultPoints: Points;
  /** What research asks to know it. Several moments can share one question. */
  ask?: { key: string; type: "answer" | "integer" | "string"; question: string };
  /** Known without asking about it: how someone left, a role, other answers. */
  auto?: true;
  custom?: true;
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
