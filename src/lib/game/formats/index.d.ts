// Types for formats/index.js (plain CommonJS so db/*.js can require it under bare node). Only the parts
// TypeScript callers use; the wiki and research halves are otherwise read by the connectors in db/.

export interface ScoringEventDef {
  id: string;
  label: string;
  defaultPoints: number;
  /** Follows from an exit, a role or an exile (impliedEvents), so it's never added or reviewed on its own. */
  implied?: boolean;
}

export interface FormatRoles {
  /** What everyone is until a role decision says otherwise ("Faithful"). */
  default: string;
  /** The values a role decision can record ("Traitor", "Recruited Traitor"). */
  values: string[];
  /** The role a recorded value makes someone ("Traitor"). */
  roleFor(value: string): string;
}

/** One research checklist question (formats/checklist.js). */
export interface ChecklistField {
  key: string;
  type: "answer" | "string" | "integer" | "enum" | "exitMethod" | "stringList";
  nullable?: boolean;
  /** Only for type "enum". */
  values?: string[];
  description?: string;
  /** A short phrase for a reviewer (data-only formats build their research notes from it). */
  note?: string;
}

/** One test in a scoring rule (formats/rules.js): an answer (research) or fact (implied) and one test,
 *  or those combined. */
export type RuleCondition =
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition }
  | { answer?: string; fact?: string; is?: string; isNot?: string; equals?: number; greaterThan?: number; present?: boolean };

/** "When this is true, award this" (formats/rules.js). A built-in rule also carries its own params. */
export interface ScoringRule {
  when?: RuleCondition;
  award?: string;
  stage?: "exiled" | "role";
  role?: string;
  builtIn?: string;
  whenExit?: string | string[];
  whenExiled?: true;
  whenRole?: string;
  per?: string;
  [param: string]: unknown;
}

/** A format's data half (formats/define.js): plain JSON, checked by formatProblems. */
export interface FormatData {
  id: string;
  name: string;
  exitMethods: string[];
  terms: { castaway: string; tribe: string };
  winnerExitMethod: string;
  endgameExitMethods: string[];
  events: { id: string; label: string; defaultPoints: number | { exclusive: number; shared: number }; implied?: boolean }[];
  eventCategories: { id: string; label: string; events: string[] }[];
  recap: { label: string; events: string[]; tribeEvents?: string[] }[];
  hasMerge: boolean;
  hasGroups: boolean;
  roles?: { default: string; values: string[] };
  wiki: {
    version?: number;
    voteSections: string[];
    guideSections: string[];
    contextSections?: string[];
    missingVotesNote: string;
    missingGuideNote: string;
    castNote?: string;
    eventTypes: string[];
    routineEliminations: number;
  };
  research: { checklist: ChecklistField[]; episodeFields: ChecklistField[]; searchHint: string[]; claims: string[] };
  /** How the format scores: research answers -> results, and events implied by exits, exile and roles. */
  rules: { research: ScoringRule[]; implied: ScoringRule[] };
}

export interface GameFormat {
  /** The data half this format was built from (not enumerable). */
  readonly data: FormatData;
  id: string;
  name: string;
  exitMethods: string[];
  /** The exit method that crowns the winner and ends the season. */
  /** A new show's default terms for its people and groups (Castaway / Tribe, Challenger / Team…). */
  terms: { castaway: string; tribe: string };
  winnerExitMethod: string;
  /** Exits that mean reaching the end (finalist, winner) rather than being knocked out. */
  endgameExitMethods: string[];
  /** The Active Roster scoring catalog. */
  events: ScoringEventDef[];
  /** The catalog grouped for display (Challenges, Tribal Council, Endgame...), in display order. */
  eventCategories: { id: string; label: string; events: string[] }[];
  /** An episode's headline wins for its Recap (Reward, Immunity...), in display order. `tribeEvents`
   *  are won as a tribe/team, so their winners always show as their group rather than one by one. */
  recap: { label: string; events: string[]; tribeEvents?: string[] }[];
  /** Whether episodes carry a post-merge flag. */
  hasMerge: boolean;
  /** Whether players are in tribes/teams that can change during the season. */
  hasGroups: boolean;
  /** Secret roles (The Traitors). Absent for shows without them. */
  roles?: FormatRoles;
  research: {
    /** One research answer as short phrases for a reviewer. */
    notes(entry: Record<string, unknown>): string[];
  };
}

export const FORMATS: Record<string, GameFormat>;
export const DEFAULT_FORMAT: string;
/** A built-in id is always the built-in; any other id resolves from `data` (a stored format's data half)
 *  when it's given for that id, and otherwise falls back to the default. */
export function formatFor(id: string | null | undefined, data?: FormatData | null): GameFormat;
export function isBuiltInFormat(id: string | null | undefined): boolean;
export function formatOptions(): { id: string; name: string }[];
/** Why a format's data half isn't usable: [] when it is. */
export function formatProblems(data: unknown): string[];
