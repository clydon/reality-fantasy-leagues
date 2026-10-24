// Types for formats/rulebook-compile.js: a rulebook's blocks compiled to the engine's format data.
import type { FormatData } from "./index";
import type { RulebookAliases, RulebookBlocks } from "./rulebook-schema";

export interface CompileOptions {
  /** Moment ids and ways out to the event ids and exit methods leagues have recorded. */
  aliases?: RulebookAliases;
  /** The format id when there's no base ("the-amazing-race"); otherwise the base's. */
  id?: string;
  /** The code half that reads the show; a built-in's ("survivor", "traitors", "challenge") brings its data as the base. */
  reader?: string | null;
  /** The format data the rulebook was frozen from: what it still scores keeps its rules and questions. */
  base?: FormatData | null;
  /** The season's confirmed phase starts, { [phaseId]: episode }: what gates a phase's segments. */
  phaseStarts?: Record<string, number>;
}

export function compileRulebook(blocks: RulebookBlocks, opts?: CompileOptions): { data: FormatData; problems: string[]; warnings: string[] };
/** Each phase's episodes; null while its start isn't known, `until` null while it's open. */
export function phaseRanges(blocks: RulebookBlocks, phaseStarts?: Record<string, number>): Record<string, { from: number; until: number | null } | null>;
export { formatForRulebook } from "./index";
