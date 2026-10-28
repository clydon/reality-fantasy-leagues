// Types for formats/blocks/index.js: the rulebook behind any format.
import type { FormatData } from "../index";
import type { RulebookAliases, RulebookBlocks } from "../rulebook-schema";

export interface RulebookSource {
  blocks: RulebookBlocks;
  aliases: RulebookAliases;
  /** Hand-written (Survivor, The Traitors, The Challenge), not read back from a format's data. */
  builtIn: boolean;
  /** The code half that reads its show (compileRulebook and formatForRulebook): a built-in's own, else research. */
  reader: "survivor" | "traitors" | "challenge" | "research";
  /** Read back from a format: that format's data, the base it compiles on (a built-in's comes with its reader). */
  base?: FormatData;
}

export const BUILT_IN_BLOCKS: Record<
  "survivor" | "traitors" | "challenge",
  /** standsAlone: the blocks say everything the built-in's code does (the golden test), so a new season compiles from them. */
  { blocks: RulebookBlocks; aliases: RulebookAliases; standsAlone?: boolean }
>;
export function rulebookFor(formatId: string | null | undefined, data?: FormatData | null): RulebookSource;
