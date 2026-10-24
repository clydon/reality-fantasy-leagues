// Types for formats/index.js (plain CommonJS so db/*.js can require it under bare node). Only the parts
// TypeScript callers use; the wiki and research halves are otherwise read by the connectors in db/.

export interface ScoringEventDef {
  id: string;
  label: string;
  defaultPoints: number;
  /** Follows from an exit, a role or an exile (impliedEvents), so it's never added or reviewed on its own. */
  implied?: boolean;
  /** Retired by a season rule change: nothing awards it from this episode on. */
  retiredFrom?: number;
}

export interface FormatRoles {
  /** What everyone is until a role decision says otherwise ("Faithful"). */
  default: string;
  /** The values a role decision can record ("Traitor", "Recruited Traitor"). */
  values: string[];
  /** A data-only format's: the role a recorded value makes someone, when not itself (custom.js). */
  becomes?: Record<string, string>;
  /** The role a recorded value makes someone ("Traitor"). */
  roleFor(value: string): string;
}

/** One research checklist question (formats/checklist.js). */
export interface ChecklistField {
  key: string;
  type: "answer" | "string" | "integer" | "number" | "enum" | "exitMethod" | "stringList";
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
  /** Once per unit: an implied rule's whole-number exit fact, or a research rule's count question (rules.js). */
  per?: string;
  /** Set on a rule a season rule change added: it applies from this episode on. */
  fromEpisode?: number;
  /** The last episode it applies to (a compiled rulebook's phase gating). */
  untilEpisode?: number;
  [param: string]: unknown;
}

/** A format's data half (formats/define.js): plain JSON, checked by formatProblems. */
export interface FormatData {
  id: string;
  name: string;
  exitMethods: string[];
  terms: { castaway: string; tribe: string };
  /** Null for a show nobody wins (a series, a talk show, a sport's standings). */
  winnerExitMethod: string | null;
  endgameExitMethods: string[];
  events: { id: string; label: string; defaultPoints: number | { exclusive: number; shared: number }; implied?: boolean; retiredFrom?: number }[];
  eventCategories: { id: string; label: string; events: string[] }[];
  recap: { label: string; events: string[]; tribeEvents?: string[] }[];
  hasMerge: boolean;
  hasGroups: boolean;
  roles?: { default: string; values: string[]; becomes?: Record<string, string> };
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
  /** Null for a show nobody wins: its season ends when nobody is left (StateLogic.seasonEnded). */
  winnerExitMethod: string | null;
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
/** A league's own ruleset copy (db/league-rulesets.js): always built from `data`, even when
 *  `data.id` matches a built-in's id -- unlike formatFor, which would return the built-in instead. */
export function formatForRuleset(data: FormatData): GameFormat;
export function isBuiltInFormat(id: string | null | undefined): boolean;
/** The code halves a compiled rulebook can read its show with. */
export const BUILT_IN_READERS: ("survivor" | "traitors" | "challenge")[];
/** A compiled rulebook's runtime format: a built-in reader's code half over `data`, else a data-only format. */
export function formatForRulebook(data: FormatData, reader?: string | null): GameFormat;
export function formatOptions(): { id: string; name: string }[];
/** Why a format's data half isn't usable: [] when it is. */
export function formatProblems(data: unknown): string[];

/** A season rule change's additions (formats/season-changes.js, docs/PLAN-season-rule-changes.md). */
export interface SeasonChangeDelta {
  addCategories?: { id: string; label: string }[];
  addEvents?: { id: string; label: string; defaultPoints: number | { exclusive: number; shared: number }; implied?: boolean; category: string }[];
  addQuestions?: ChecklistField[];
  addExitMethods?: { name: string; endgame?: boolean }[];
  addRules?: { research?: ScoringRule[]; implied?: ScoringRule[] };
  retireEvents?: string[];
}
/** One season rule change, as a league caches it (settings.seasonRuleChanges / adoptedRuleChanges). */
export interface SeasonChange {
  id: string;
  version?: number;
  effectiveEpisode: number;
  /** What changed, in a sentence or two (the commissioner's adopt card shows it). */
  summary?: string;
  delta: SeasonChangeDelta;
}
/** Something a change adds that the base already has (or that depends on it), left out and why. */
export interface SeasonChangeSkip {
  change: string;
  what: string;
  why: string;
}
/** `format` with `changes` layered on (the same format when there are none). */
export function withChanges(format: GameFormat, changes: SeasonChange[] | null | undefined): GameFormat;
/** A format's data half with `changes` merged in, and what was skipped. Throws on a malformed change. */
export function applyChanges(data: FormatData, changes: SeasonChange[]): { data: FormatData; skipped: SeasonChangeSkip[] };
/** Why a change isn't well-formed on its own: [] when it is. */
export function changeProblems(change: unknown): string[];
