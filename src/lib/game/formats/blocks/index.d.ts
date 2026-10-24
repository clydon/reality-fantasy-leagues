// Types for formats/blocks/index.js: the rulebook behind any format.
import type { FormatData } from "../index";
import type { RulebookAliases, RulebookBlocks } from "../rulebook-schema";

export interface RulebookSource {
  blocks: RulebookBlocks;
  aliases: RulebookAliases;
  /** Hand-written (Survivor, The Traitors, The Challenge), not read back from a format's data. */
  builtIn: boolean;
}

export const BUILT_IN_BLOCKS: Record<"survivor" | "traitors" | "challenge", { blocks: RulebookBlocks; aliases: RulebookAliases }>;
export function rulebookFor(formatId: string | null | undefined, data?: FormatData | null): RulebookSource;
