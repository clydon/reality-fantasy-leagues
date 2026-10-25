// Types for formats/rulebook-patch.js: rulebook edits as ops, and the rules when the show changed from an episode on.
import type { FormatData } from "./index";
import type { RulebookBlocks } from "./rulebook-schema";

export type RulebookListBlock = "segments" | "waysOut" | "twists" | "customMoments" | "phases";
export type RulebookSingleBlock = "kind" | "start" | "show" | "tagline" | "premise" | "parts" | "cast" | "finale" | "points" | "momentNotes" | "leftOut";

export type RulebookOp =
  | { op: "set"; block: RulebookSingleBlock; value: unknown }
  | { op: "add"; block: RulebookListBlock; value: { id: string } & Record<string, unknown>; at?: number }
  | { op: "update"; block: RulebookListBlock; id: string; value: { id: string } & Record<string, unknown> }
  | { op: "remove"; block: RulebookListBlock; id: string };

export function diffBlocks(a: RulebookBlocks, b: RulebookBlocks): RulebookOp[];
export function applyOps(blocks: RulebookBlocks, ops: RulebookOp[]): RulebookBlocks;
/** The blocks as of episode `n` (Infinity: every edit). */
export function blocksAt(base: RulebookBlocks, edits: { fromEpisode: number; ops: RulebookOp[] }[], n: number): RulebookBlocks;
/** "+ New advantage: Block a Vote", "~ Reward challenge: how often", "− Sent to Exile". */
export function opLines(ops: RulebookOp[], before: RulebookBlocks, after: RulebookBlocks): string[];
/** `before` up to episode n - 1, `after` from n. */
export function mergeAtEpisode(before: FormatData, after: FormatData, n: number): FormatData;
export function sameBlocks(a: unknown, b: unknown): boolean;
