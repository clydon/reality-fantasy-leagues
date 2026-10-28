// Types for game-spec/index.js: a game as data (docs/PLAN-start-a-game-gpt.md, "The game spec", step A1). Values marked
// sports are in the schema now and built by the sports branch (VOCAB says which); today's engine plays the rest (questions
// since step A4).
import type { LeagueSettings } from "../types";

export type PresetId = "outlast" | "weekly-lineup" | "survival-pool" | "weekly-calls" | "weekly-bingo";
export type LeagueTypeId = "classic-draft" | "active-roster" | "pickem" | "weekly-calls" | "weekly-bingo" | "questions";
/** Who builds a value: today's engine, a later step, the sports branch, or no step yet. */
export type Builder = "now" | "sports" | "later";

/** A start at a phase of the season's rulebook (A3): { phase } while it waits for it, { phase, at } once data says where it
 *  starts (at: the episode it plays from). */
export interface PhaseFrom {
  phase: string;
  at?: number;
}

export interface SpecSpan {
  /** The episode it starts at, or a phase start. */
  from: number | PhaseFrom;
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
  | { by: "lines" }
  /** Only the ask's questions (A4): Weekly Calls (the show's calls), a game of questions. */
  | { by: "answers" }
  /** sports: the Sport's stat keys -> points */
  | { by: "stats"; points: Record<string, number> };

export interface SpecRank {
  /** total, streak: today. sports: matchups, categories, roto. */
  by: "total" | "streak" | "matchups" | "categories" | "roto";
}

export type SpecSettle =
  /** out: who goes home (asked once: the first in the game; a group answer: the groups they were on); stays: who doesn't (an
   *  episode's); winner, placed (`place`th) and top (in the top `place`): the season's. */
  | { by: "results"; take: "winner" | "out" | "placed" | "top" | "stays"; place?: number }
  /** In the episode (asked once, over the game; over a window, A7): whether it happened, how many times (a per-unit moment's
   *  units), who it happened to (a group answer: their groups), who most (A6), first (A7: who, or which episode). */
  | { by: "moment"; moment: string; take: "happened" | "count" | "who" | "most" | "first" }
  /** A7: a phase of the season (not its first): the episode it starts (asked once), or whether it starts in the window. */
  | { by: "phase"; phase: string; take: "starts" | "happened" }
  /** A secret role (A6): who held it, who held it among those still in at the end, how many of them. */
  | { by: "role"; role: string; take: "who" | "end" | "count" }
  /** The show's calls (Call it's: calls.ts), Weekly Calls' one question. */
  | { by: "calls" }
  /** sports */
  | { by: "final"; take: "winner" | "total" | "margin" }
  /** sports */
  | { by: "stat"; stat: string; take: "most" | "least" | "value" };

/** A question answered before its lock (A4), each settled by data. */
export interface SpecQuestion {
  /** Its key, for its answers (game_answers.question): letters, digits, ".", "_" or "-", up to 40. */
  id: string;
  ask: string;
  /** group: a tribe or team (A6). side: sports. calls: the show's calls (Weekly Calls'). */
  answer: "person" | "group" | "side" | "yesNo" | "number" | "overUnder" | "choice" | "calls";
  /** A right answer's (a right pick's). */
  points: number;
  settle: SpecSettle;
  /** once (for the game; the default) | each (every episode it plays) | every (A7: each run of `every` episodes) | phase (A7:
   *  once a phase of the season). Its answers are for the window they open at. */
  asked?: "once" | "each" | "every" | "phase";
  /** A7, asked every: how many episodes each run is (2 to 10). */
  every?: number;
  /** A7, asked each: about that episode and the next over - 1 (2 to 10). */
  over?: number;
  /** start: when its window's first episode starts (asked each, every or by phase) or the game's first does (the default) |
   *  finale: the season's last (asked once). */
  closes?: "start" | "finale";
  /** A person or group answer: how many to name (default 1), each right one scores. */
  pick?: number;
  /** A person answer: the cast still in (default), or your own team (a draft's). */
  from?: "cast" | "team";
  /** overUnder's line; null: the wizard asks (or ESPN's, the sports branch). */
  line?: number | null;
  /** choice's options. */
  options?: string[];
  /** A6: asked about each person still in when it closes, answered { castawayId: answer } (a yes or no, a number, an over/under or
   *  a choice for each), settled for each by their own moment or whether they go home or stay. */
  each?: "person";
}
/** A question as a spec holds it once it's whole (fullSpec): asked and closes always said. */
export type Question = SpecQuestion & { asked: "once" | "each" | "every" | "phase"; closes: "start" | "finale" };

/** What a game's results say, for grading its questions (answers.js). */
export interface AnswerFacts {
  from: number | null;
  to: number | null;
  over: boolean;
  /** Each of the game's episodes with results (answers.js has what each part says). */
  episodes: Map<
    number,
    {
      out: string[] | null;
      events: Map<string, number> | null;
      /** A6's (AnswerLogic.facts always gives them; the grader reads a missing one as nobody). */
      who?: Map<string, Map<string, number>> | null;
      in?: string[];
      groups?: Map<string, string | null>;
      roles?: Map<string, string | null> | null;
    }
  >;
  winner: string | null;
  ended: boolean;
  order: string[] | null;
  names: Map<string, string>;
  groupNames?: Map<string, string>;
  /** A7: each phase's start the viewer has seen; the game's later phase windows; the last episode they've seen with results. */
  phases?: Map<string, number>;
  windows?: { phase: string; at: number; from: number }[];
  seen?: number;
}
/** How a question stands: still to settle, off (nobody went home, right on the line), or what was right (and a count; the
 *  groups the right people were on; a question about each person, each one's verdict by castaway id). */
export type Verdict =
  | { state: "waiting" }
  | { state: "off"; why: string }
  | { state: "known"; right: string[]; value?: number; groups?: string[]; each?: Record<string, Verdict> };

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
  /** A7, a game of questions': someone who hasn't seen an episode answers its questions until they have, up to these hours past
   *  its air time; null: none. */
  lateLock: { hours: 12 | 24 | 48 | 72 } | null;
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
  ask: Question[];
  /** start: today. sports: daily, weekly. */
  closes: "start" | "daily" | "weekly";
  extras: SpecExtras;
}

/** A spec as written: anything left out is the preset's, or the defaults (fullSpec). */
export type SpecInput = Partial<Omit<GameSpec, "extras" | "ask">> & { extras?: Partial<SpecExtras>; ask?: SpecQuestion[] };

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
  /** false when nobody wins the show (no way out that means winning): who wins, where they finish and a top can't settle. */
  winner?: boolean;
  /** Who settles the show's calls: its results, or (a talk show) the couch, whose word only a league's own keeps. */
  calls?: "results" | "couch";
  /** The season's rulebook's phases, in order (its blocks' season.phases): a phase start is one of them, never the first. */
  phases?: { id: string; name?: string }[];
  /** The show's secret roles (its secretRole twists': ["Traitor", "Faithful"]): a role settles only if it's one (A6). */
  roles?: string[];
  /** false when nobody on the show is in a group (its cast has none): no group answers (A6). */
  grouped?: boolean;
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
export const TYPE_PRESETS: Partial<Record<LeagueTypeId, PresetId>>;
export const PRESET_LABELS: Record<PresetId, string>;
export const NO_WAIVERS: SpecWaivers;
/** Waivers fit a draft whose castaways can come free (not a shared Outlast). */
export function waiversFit(spec: Partial<GameSpec>): boolean;
/** Side bets go with a draft: nothing else scores them (A4). */
export function betsFit(spec: Partial<GameSpec>): boolean;
/** The ask presets (A4): Weekly Calls' question (the show's calls), and a draft's finale predictions as two questions. */
export const CALLS: Question;
export function finaleQuestions(f: { top3: number; winner: number; from: "any" | "own" }): Question[];
export function finaleOf(ask: SpecQuestion[] | null | undefined): { top3: number; winner: number; from: "any" | "own" } | null;
/** The answers that name someone (a person) or something (a group), `pick` of them (A6). */
export const NAMES: readonly SpecQuestion["answer"][];
/** The settles a number answer is graded by ("by:take"). */
export const NUMBERS: readonly string[];
/** A question about each person (A6), by its answer: what settles it for each of them ("by:take"). */
export const EACH_SETTLES_FOR: Partial<Record<SpecQuestion["answer"], string[]>>;
export function isCalls(q: unknown): boolean;
export function callsAsk(ask: unknown): boolean;
export function fullQuestion(q: SpecQuestion): Question;
/** A choice option as the range a count falls in ("2", "3+", "0-1"), else null. */
export function optionRange(o: string): { min: number; max: number } | null;
export const MAX_QUESTIONS: number;
export const MAX_PICK: number;
export const MAX_QUESTION_POINTS: number;
/** Grading (answers.js): how a question stands, what each answer earns, whether one was right, why one can't be given. */
export function verdictOf(q: Question, episode: number, facts: AnswerFacts): Verdict;
export function rightAnswers(q: Question, v: Verdict, facts?: AnswerFacts): string[] | null;
export function pointsFor(q: Question, v: Verdict, answers: { playerId: string; answer: unknown }[], facts?: AnswerFacts): Map<string, number>;
export function isRight(q: Question, v: Verdict, mine: { playerId: string; answer: unknown }, answers: { playerId: string; answer: unknown }[], facts?: AnswerFacts): boolean | null;
export function answerProblem(q: Question, value: unknown, faces?: Set<string> | null): string | null;
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

/** The episode a span plays from: its number, a phase start's `at`, or null while it waits for its phase. */
export function spanStart(span: SpecSpan | null | undefined): number | null;
/** The phase a span starts at, or null. */
export function spanPhase(span: SpecSpan | null | undefined): string | null;

/** The spec with everything it leaves out filled in (the preset's, or the defaults); never mutates it. */
export function fullSpec(spec: SpecInput | GameSpec): GameSpec;
/** The league type today's engine plays it as, or null. */
export function typeOf(spec: SpecInput | GameSpec): LeagueTypeId | null;
/** typeOf on a spec that's already whole, without copying it. */
export function playsAs(spec: GameSpec): LeagueTypeId | null;
/** The league type's flags, worked out from a whole spec. */
export function flagsOf(spec: GameSpec): {
  hasRoster: boolean; hasActiveRoster: boolean; hasWeeklyPicks: boolean; hasCalls: boolean; hasQuestions: boolean; hasBingo: boolean;
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
