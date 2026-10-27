import { rulebookFor } from "./formats/blocks/index.js";
import type { FormatData } from "./formats/index.js";
import { compileRulebook } from "./formats/rulebook-compile.js";
import { parseRulebookAnswer, reviewRulebook } from "./formats/rulebook-research.js";
import type { RulebookAliases, RulebookBlocks } from "./formats/rulebook-schema";
import type { LeagueRulebook, LeagueState } from "./types";

// Shadow games (docs/PLAN-researched-survivor.md): a couch's real games copied, every move and result as they are, to be
// played on other rules without touching the real ones. The local tool (scripts/dev-test/shadow-leagues.js, from a backup)
// and production's test couch (src/lib/server/test-couch.ts, from the live games) both build them with these. Pure.
//
// The rules a shadow plays by:
//   same        the real game's own, unchanged (the baseline: every table matches)
//   template    its show's built-in rules as a rulebook: the library blocks compiled with the research reader and the
//               template's aliases, so every recorded result keeps its event id (scores the same: the switch's first stage)
//   fresh       the same blocks compiled as research compiles a rulebook (no aliases): new event ids, questions and exits
//   researched  a researched rulebook: an answer to the rulebook research prompt (Make it a game's), compiled as Make it a
//               game compiles it (make-game.ts workOut: the research reader, no aliases)

export type ShadowRules = "same" | "template" | "fresh" | "researched";
export const SHADOW_RULES: ShadowRules[] = ["same", "template", "fresh", "researched"];

export interface CompiledRules {
  /** null for `same`: the game keeps its own rules. */
  compiled: FormatData | null;
  blocks: RulebookBlocks | null;
  aliases: RulebookAliases | null;
  warnings: string[];
}

/** What a shadow game plays by. `format`: the real game's show format (its template); `answer`: for `researched`. */
export function shadowRules(mode: ShadowRules, o: { format?: string | null; answer?: string | null; castNames?: string[] } = {}): CompiledRules {
  if (mode === "same") return { compiled: null, blocks: null, aliases: null, warnings: [] };
  if (mode === "template" || mode === "fresh") {
    const tpl = rulebookFor(o.format || "survivor", null) as unknown as { blocks: RulebookBlocks; aliases?: RulebookAliases };
    const aliases = mode === "template" ? (tpl.aliases ?? null) : null;
    const c = compileRulebook(tpl.blocks, { aliases: aliases ?? undefined, reader: "research", id: "shadow" });
    if (c.problems.length) throw new Error(`the template doesn't compile: ${c.problems.join("; ")}`);
    return { compiled: c.data as FormatData, blocks: tpl.blocks, aliases, warnings: c.warnings };
  }
  if (!o.answer) throw new Error("researched rules need an answer to the research prompt");
  const read = reviewRulebook(parseRulebookAnswer(o.answer), { castNames: o.castNames ?? [] }) as unknown as { blocks: RulebookBlocks; phaseStarts?: Record<string, number>; problems?: string[] };
  const c = compileRulebook(read.blocks, { reader: "research", id: "shadow", phaseStarts: read.phaseStarts });
  if (c.problems.length) throw new Error(`the answer's rulebook doesn't compile: ${c.problems.join("; ")}`);
  return { compiled: c.data as FormatData, blocks: read.blocks, aliases: null, warnings: [...(read.problems ?? []), ...c.warnings] };
}

/**
 * A real game's state for its shadow: everything as it is (the draft, every lineup, pick, waiver week and result), marked
 * with its source (settings.shadowOf), on `rulebook` (none: its own rules, as they are); `rename` gives each seat its stand-in's name.
 */
export function shadowState(real: LeagueState, o: { sourceId: string; rulebook: LeagueRulebook | null; rename?: (player: { id: string; name: string }) => string }): LeagueState {
  const s = JSON.parse(JSON.stringify(real)) as LeagueState;
  const settings = s.settings as LeagueState["settings"] & { shadowOf?: string };
  settings.shadowOf = o.sourceId;
  if (o.rulebook) settings.rulebook = o.rulebook;
  if (o.rename) for (const p of s.players) p.name = o.rename(p);
  return s;
}
