// Types for formats/rulebook-from-format.js: a rulebook's blocks read back from a format's data half.
import type { FormatData } from "./index";
import type { RulebookAliases, RulebookBlocks } from "./rulebook-schema";

export function blocksFromFormat(data: FormatData): { blocks: RulebookBlocks; aliases: RulebookAliases };
