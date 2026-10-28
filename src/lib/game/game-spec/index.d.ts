// Types for game-spec/index.js: a game as data (docs/PLAN-start-a-game-gpt.md, "The game spec", step A1). Values marked
// A3, A4 or sports are in the schema now and built by those steps (VOCAB says which); today's engine plays the rest.
import type { LeagueSettings } from "../types";

export type PresetId = "outlast" | "weekly-lineup" | "survival-pool" | "weekly-calls" | "weekly-bingo";
export type LeagueTypeId = "classic-draft" | "active-roster" | "pickem" | "weekly-calls" | "weekly-bingo";
/** Who builds a value: today's engine, a later step, the sports branch, or no step yet. */
export type Builder = "now" | "A3" | "A4" | "sports" | "later";

export interface SpecSpan {
  /** The episode it starts at; A3: { phase } waits for a rulebook phase. */
  from: number | { phase: string };
  /** Its last episode, or null: the season's end. */
  to: number | null;
}

export interface SpecPool {
  of: "cast";
  /** null or { stillIn: true }: today. sports: { teams }. later: { group }. */
  where: null | { stillIn: true } | { teams: string[] } | { group: string };
}

export type SpecGet =
  | { by: "draft"; each: number; order: "snake" | "blind"; own: "exclusive" | "shared" }
  | { by: "pick"; each: 1; repeat: "cycle" }
  | { by: "card" }
  | { by: "none" }
  /** sports */
  | { by: "squares" };

export type SpecCount =
  | { start: number }
  | { all: true }
  | { pick: true }
  /** sports: best ball */
  | { best: number }
  | null;

export type SpecScore =
  /** points: moment id -> points over the rulebook's own; null = its own. */
  | { by: "moments"; points: Record<string, number> | null }
  | { by: "place" }
  | { by: "survive"; means: "staysIn" | "scores"; points: number }
  | { by: "calls" }
  | { by: "lines" }
  /** A4 */
  | { by: "answers" }
  /** sports: the Sport's stat keys -> points */
  | { by: "stats"; points: Record<string, number> };

export interface SpecRank {
  /** total, streak: today. sports: matchups, categories, roto. */
  by: "total" | "streak" | "matchups" | "categories" | "roto";
}

export type SpecSettle =
  | { by: "results"; take: "winner" | "out" | "placed"; place?: number }
  | { by: "moment"; moment: string; take: "happened" | "count" }
  /** sports */
  | { by: "final"; take: "winner" | "total" | "margin" }
  /** sports */
  | { by: "stat"; stat: string; take: "most" | "least" | "value" };

/** A question answered before the lock (A4), each settled by data. */
export interface SpecQuestion {
  id: string;
  ask: string;
  /** side: sports. */
  answer: "person" | "side" | "yesNo" | "number" | "overUnder" | "choice";
  points: number;
  settle: SpecSettle;
  /** overUnder's line; null: the wizard asks (or ESPN's, the sports branch). */
  line?: number | null;
  /** choice's options. */
  options?: string[];
}

export interface SpecWaivers {
  feel: "casual" | "balanced" | "competitive";
  replace: "always" | "whenShort" | "windows" | "never";
  /** whenShort's N; null: the recommended (starting spots - 1). */
  short: number | null;
  windows: { schedule: "everyEpisode" | "every" | "manual"; every: number; swaps: number };
  order: "rolling" | "leastPoints" | "mostPoints";
  hours: 12 | 24 | 48;
  freeAgency: boolean;
  autoFill: boolean;
}

export interface SpecExtras {
  /** A draft's mid-season moves; null: none (shared Outlast, no draft). */
  waivers: SpecWaivers | null;
  /** Side bets ("Predictions", graded by whoever runs the game): each new one's points; null: off. */
  bets: { points: number } | null;
  /** A draft's finale predictions; null: off. */
  finale: { top3: number; winner: number; from: "any" | "own" } | null;
  /** A Survival Pool's weekly Who goes home? call (the public pool): counted, not ranked. */
  calls: boolean;
  /** A draft's room; null: no draft. */
  draft: { at: string | null; timer: 0 | 60 | 120; away: "wait" | "queue" } | null;
  /** Who can join; null: the recommended (open where castaways can be on several teams, else ask). */
  join: "open" | "ask" | "locked" | null;
  /** A lineup's starters stay hidden until the lock. */
  hideStarters: boolean;
  /** Lock it down: nobody new joins, the rules don't change for the season. */
  lockedDown: boolean;
}

export interface GameSpec {
  spec: 1;
  preset: PresetId | null;
  span: SpecSpan;
  pool: SpecPool;
  get: SpecGet;
  count: SpecCount;
  score: SpecScore;
  rank: SpecRank;
  ask: SpecQuestion[];
  /** start: today. sports: daily, weekly. */
  closes: "start" | "daily" | "weekly";
  extras: SpecExtras;
}

/** A spec as written: anything left out is the preset's, or the defaults (fullSpec). */
export type SpecInput = Partial<Omit<GameSpec, "extras">> & { extras?: Partial<SpecExtras> };

/** What a spec refers to, in the show's words, and the data that settles it. All optional. */
export interface SpecContext {
  /** "Survivor 51", "the Red Sox–Yankees series". */
  show?: string;
  /** What the show calls one of its people, lower case ("castaway"), and many ("castaways"). */
  castaway?: string;
  castaways?: string;
  /** What one part of the season is called. */
  part?: { singular: string; plural: string };
  /** The scoring groups' labels (a format's eventCategories). */
  groups?: string[];
  /** The show's moments (rulebook-moments.js momentsFor, or a format's events). */
  moments?: { id: string; label?: string; defaultPoints?: number | { exclusive: number; shared: number }; answeredBy?: "research" | "league"; auto?: boolean; off?: boolean }[];
  /** The sport's stat keys (the Sport's, on the sports branch); a label is a singular noun ("home run"). */
  stats?: ({ key: string; label?: string } | string)[];
  /** false when the show's results don't say who goes home or wins. */
  results?: boolean;
}

export interface SpecProblem {
  at: string;
  problem: string;
}
export interface SpecWait {
  at: string;
  /** The step that builds it; null: every part is built, but no game plays them together yet. */
  step: Exclude<Builder, "now"> | null;
  problem: string;
}

export interface SpecDescription {
  /** The preset's name ("Weekly Lineup"), or null. */
  name: string | null;
  sentence: string;
  /** The sentence in pieces, with the part of the spec each says. */
  parts: { text: string; at: "preset" | "about" | "get" | "count" | "span" | "score" | "ask" | "rank" | null }[];
  /** How it works, a rule a line. */
  rules: string[];
  /** The details nobody asked about. */
  details: { id: string; label: string; value: string; recommended: boolean }[];
}

/** A league's settings fields as a spec writes them; undefined: the field goes. */
export type SpecFields = Partial<Record<keyof LeagueSettings | "joinMode" | "replaceRule", unknown>>;

export const SPEC_VERSION: 1;
export const VOCAB: Record<string, Record<string, Builder>>;
export const PRESETS: Record<PresetId, GameSpec>;
export const PRESET_TYPES: Record<PresetId, LeagueTypeId>;
export const TYPE_PRESETS: Record<LeagueTypeId, PresetId>;
export const PRESET_LABELS: Record<PresetId, string>;
export const NO_WAIVERS: SpecWaivers;
/** Waivers fit a draft whose castaways can come free (not a shared Outlast). */
export function waiversFit(spec: Partial<GameSpec>): boolean;
/** The one set of size limits (an Outlast team; a lineup's starters and bench; a lineup's whole team). */
export const MAX_TEAM: number;
export const MAX_STARTERS: number;
export const MAX_BENCH: number;
export const MAX_LINEUP_TEAM: number;
export const MAX_BET_POINTS: number;
export const DRAFT_TIMERS: number[];
export const WAIVER_HOURS: number[];
export const REPLACE_RULES: SpecWaivers["replace"][];
export const WAIVER_FEELS: SpecWaivers["feel"][];
export const WAIVER_ORDERS: SpecWaivers["order"][];
/** Two values the same, whatever order their keys are in. */
export function sameValue(a: unknown, b: unknown): boolean;
/** Settings fields a spec can write, and those that aren't the game at all. */
export const OWNED: string[];
export const OUTSIDE: string[];

/** The spec with everything it leaves out filled in (the preset's, or the defaults); never mutates it. */
export function fullSpec(spec: SpecInput | GameSpec): GameSpec;
/** The league type today's engine plays it as, or null. */
export function typeOf(spec: SpecInput | GameSpec): LeagueTypeId | null;
/** typeOf on a spec that's already whole, without copying it. */
export function playsAs(spec: GameSpec): LeagueTypeId | null;
/** The league type's flags, worked out from a whole spec. */
export function flagsOf(spec: GameSpec): {
  hasRoster: boolean; hasActiveRoster: boolean; hasWeeklyPicks: boolean; hasCalls: boolean; hasBingo: boolean;
  supportsReplenish: boolean; supportsTrade: boolean; supportsFinalePredictions: boolean;
};
/**
 * What's wrong with it; with ctx, the data-can-settle rule too. opts.league: it's a league's own (every write to a
 * league), so its couch-answered moments (Make it ours) and points for moments its rules don't have stay as they are;
 * opts.was, with it: the spec it's changing from, so the size limits hold for what grows.
 */
export function specProblems(spec: unknown, ctx?: SpecContext | null, opts?: { league?: boolean; was?: SpecInput | GameSpec }): SpecProblem[];
/** What it needs that isn't built yet; empty when today's engine plays it. */
export function specWaitsFor(spec: SpecInput | GameSpec): SpecWait[];
/** The spec a league's settings play, from its fields. */
export function specOf(settings: Partial<LeagueSettings> | Record<string, unknown> | null | undefined): GameSpec;
/** The spec a league plays: its carried settings.game, else specOf. Read only. */
export function gameOf(settings: Partial<LeagueSettings> | Record<string, unknown> | null | undefined): Readonly<GameSpec>;
/** A side bet's points, 1 to MAX_BET_POINTS. */
export function clampBet(v: unknown): number;
/** The settings fields a spec writes, or null when it has problems or no game plays it today. */
export function settingsOf(spec: SpecInput | GameSpec): SpecFields | null;
export function ownedFields(spec: SpecInput | GameSpec): string[] | null;
/** The settings with the spec's fields written into a copy, or null when settingsOf has none. */
export function withSpec<T extends object>(settings: T, spec: SpecInput | GameSpec): T | null;
export function describeSpec(spec: SpecInput | GameSpec, ctx?: SpecContext | null): SpecDescription;
