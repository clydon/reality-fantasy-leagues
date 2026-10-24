// Types for formats/library/index.js: researched rulebooks, blocks and compiled format data together.
import type { FormatData } from "../index";
import type { RulebookBlocks } from "../rulebook-schema";

export interface LibraryRulebook {
  id: string;
  show: string;
  /** A research draft until a person reviews it. */
  status: "draft" | "reviewed";
  researched: { for: string; on: string; by: string; castChecked: boolean };
  /** What didn't fit the schema, as research said it. */
  leftOut: string[];
  blocks: RulebookBlocks;
  /** What the blocks compile to (rulebook-compile.js); the winner may be null. */
  compiled: Omit<FormatData, "winnerExitMethod"> & { winnerExitMethod: string | null };
}

export const LIBRARY: Record<string, LibraryRulebook>;
export function libraryRulebook(id: string): LibraryRulebook | null;
