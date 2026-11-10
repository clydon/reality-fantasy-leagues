// Types for the Start-a-game GPT's words to a spec (index.js; docs/PLAN-start-a-game-gpt.md step G1).
import type { SpecContext, SpecDescription } from "../game-spec/index.js";

export interface PackInput {
  label: string;
  show?: string;
  season?: number;
  kind?: "show" | "sport";
  status?: string;
  today?: string;
  episodes?: { aired?: number; total?: number; next?: { number: number; airs?: string } | null };
  phases?: { id: string; name?: string; starts?: number }[];
  castWord?: { one?: string; many?: string };
  groupWord?: string;
  cast?: { id?: string; name: string; in?: boolean; out?: { episode: number; how?: string } | null; group?: string | null; role?: string | null }[];
  /** G3: people left out of a long cast (a sport's many teams). */
  castMore?: number;
  ctx?: SpecContext | null;
  /** G3, a sport's page: its sport, teams, games (each episode's), the stats a request can name, and its standard game. */
  sport?: { id?: string; name?: string; league: string } | null;
  teams?: SportTeam[];
  games?: SportGame[];
  gamesMore?: number;
  stats?: { key: string; says?: string; short?: string; one?: string; place?: boolean; rate?: boolean }[];
  standard?: SportStandard | null;
  /** G3 part 2, a team's page (no season yet): the team, its schedule (sports/team-page.ts teamSchedulePack) and what it leaves out. */
  team?: { id: string; name: string; short?: string } | null;
  schedule?: ScheduleLine[];
  scheduleMore?: number;
  couch?: { people?: number | null; games?: { name: string; says?: string }[] } | null;
}

/** A team's game as a team's page lists it (sports/team-page.ts ScheduleLine). */
export interface ScheduleLine {
  id: string;
  day?: string | null;
  at?: string | null;
  home: boolean | null;
  opponent?: SportTeam | null;
  played: boolean;
  stage?: string;
  note?: string;
  called?: string;
}

export interface SportTeam {
  id: string;
  name: string;
}
export interface SportGame {
  episode: number;
  at?: string;
  id?: string;
  name?: string;
  sides: (SportTeam & { home?: true })[];
  started: boolean;
  /** ESPN's line on its total, while it's still to play. */
  line?: number;
  called?: string;
}
export interface SportStandard {
  scoring?: Record<string, number>;
  starters?: number;
  bench?: number;
  locks?: string;
  games: { id: string; about: string }[];
}

export interface Pack {
  page: string;
  show?: string;
  season?: number;
  kind: "show" | "sport";
  status?: string;
  today?: string;
  episodes: { aired: number; total?: number; next: { number: number; airs?: string } | null };
  phases: { id: string; name: string; starts?: number }[];
  words: { person: string; people: string; group?: string };
  cast: { id?: string; name: string; in: boolean; out?: { episode: number; how?: string }; group?: string; role?: string }[];
  castMore?: number;
  stillIn: number;
  /** A show's (a sport's page has none). */
  moments?: { id: string; says: string; points?: number | { exclusive: number; shared: number } }[];
  couchWordOnly?: { id: string; says: string }[];
  roles?: string[];
  sport?: { id: string; name?: string; league: string };
  teams?: SportTeam[];
  games?: SportGame[];
  gamesMore?: number;
  stats?: { key: string; says: string; short?: string; one?: string; place?: true; rate?: true }[];
  standard?: SportStandard;
  team?: { id: string; name: string; short?: string };
  schedule?: (Omit<ScheduleLine, "opponent"> & { against: SportTeam | null })[];
  scheduleMore?: number;
  knows: Record<string, boolean>;
  couch: { people: number | null; games: { name: string; says?: string }[] } | null;
}

export interface Draft {
  game: Record<string, unknown> | null;
  /** G3 part 2, a team's page: the games their words mean, as the bot named them (a matchup ask, unread). */
  matchup?: Record<string, unknown> | null;
  said: { part: string | null; quote: string }[];
  assumed: { part: string; value: unknown; why: string }[];
  ask: { part: string | null; question: string; options: string[] }[];
  cantYet: { what: string; why: string; nearest: string | null; newMoment?: string }[];
  about: { show: string; season?: number } | null;
  also: string | null;
  summary: string;
}

export interface WizardAsk {
  part: string | null;
  question: string;
  options: string[];
  by: "bot" | "check";
  /** G3 part 2, which games (part "matchup"): what each option picks (a matchup ask), for the wizard to send back as it is. */
  picks?: Record<string, unknown>[];
  moment?: { label: string; question: string; reliable: Reliability; why: string };
}

export type Reliability = "high" | "medium" | "low";

export interface CheckResult {
  state: "game" | "ask" | "cantYet" | "none";
  spec: Record<string, unknown> | null;
  describe: SpecDescription | null;
  said: { part: string | null; quote: string }[];
  assumed: { part: string; value: unknown; why: string; by: "bot" | "check" }[];
  ask: WizardAsk[];
  cantYet: { what: string; why: string; nearest: string | null; newMoment?: string; step?: string | null; offered?: boolean }[];
  newMoments: { label: string; what: string }[];
  /** `quiet`: a reading of their words (G3: a stat's key, ESPN's line, the sport's standard table), shown as assumed, never asked. */
  fixed: { part: string; problem: string; from: unknown; to: Record<string, unknown>; options: string[]; quiet?: true }[];
  dropped: { part: string | null; value: unknown; why: string; ours?: unknown }[];
  offers: { otherShow?: { show: string; season?: number }; second?: { summary: string }; moments?: { label: string; question: string; reliable: Reliability; why: string }[] };
  problems: { at: string; problem: string }[];
  waits: { at: string; step: string; problem: string }[];
}

export type AnswerResult = (CheckResult & { notes: string[]; botSummary: string; matchup?: Record<string, unknown> }) | { state: "unreadable"; why: string; notes: string[] };

export interface MomentRating {
  reliable: Reliability;
  why: string;
  /** G1 part 4: whether it happens to someone in the cast (asked who) or is about the episode itself (not offered yet). */
  about?: "person" | "episode";
  question: string;
  label: string;
  nearest: string[];
}

export interface CheckOptions {
  ctx?: SpecContext | null;
  pack?: Pack | null;
  words?: string;
  kind?: "show" | "sport";
  /** G3, a sport's page: the sport's standard games (sports/page.ts sportGames), whose tables fill a stats score with none. */
  games?: SportGameSpec[];
  /** A typed change: what the ask it changes said and assumed. */
  carry?: { said?: { part: string | null; quote: string }[]; assumed?: { part: string; value: unknown; why: string; by?: "bot" | "check" }[] } | null;
}

export const WORDS: Record<string, { what: string; values: Record<string, string>; sport?: string[]; show?: string[] }>;
export function manualFor(ctx: SpecContext | null, o?: { kind?: "show" | "sport"; examples?: unknown[]; limit?: number; show?: string | null; games?: SportGameSpec[]; team?: boolean }): string;
/** A sport's standard game (sports/page.ts sportGames). */
export interface SportGameSpec {
  id: string;
  about: string;
  spec: Record<string, unknown>;
  on?: "playoffs";
}
export function sportGameSpec(spec: unknown): Record<string, unknown>;
export const FIELDS: Record<string, string>;
export function fieldsOf(spec: unknown): Set<string>;
export function fieldExamples(ctx: SpecContext | null, rows: unknown[], o?: { show?: string | null }): Map<string, { words: string; spec: unknown }>;
export function examplesFor(ctx: SpecContext | null, rows: unknown[], o?: { limit?: number; cant?: number; show?: string; kind?: "show" | "sport" }): { playing: { words: string; spec: unknown; sentence: string }[]; waiting: { words: string; why: string }[] };
/** The worked examples: the tracker's requests with a lesson (`teach`), the user's own games (G1's typed fixes). */
export function workedFor(ctx: SpecContext | null, rows: unknown[], o?: { show?: string | null; kind?: "show" | "sport"; limit?: number }): { words: string; spec: unknown; teach: string; on?: string }[];
export function signature(spec: unknown): string;
export function packOf(input: PackInput): Pack;
export function idsOf(pack: Pack): Record<string, Set<string>>;
export function statKeyIn(stats: { key: string; says?: string; short?: string; one?: string }[], words: string): string | null;
export function gamePrompt(o: { pack: Pack; manual: string; words: string }): string;
export function changePrompt(o: { pack: Pack; manual: string; words: string; spec: unknown; change: string; matchup?: unknown; button?: string }): string;
export function momentPrompt(o: { pack: Pack; moment: string }): string;
export function momentsPrompt(o: { pack: Pack; moments: string[] }): string;
export function inventPrompt(o: { pack: Pack; words: string; n: number }): string;
export const BUTTONS: Record<string, string>;
export function readDraft(answer: string): { draft: Draft; notes: string[] };
export function readMoment(answer: string): MomentRating;
export function readMoments(answer: string, n: number): MomentRating[];
/** G5: a made-for game, as the bot wrote it (made.js). */
export interface MadeIdea {
  base: string | null;
  length: "one" | "few" | "season";
  name: string;
  hook: string;
  fits: string | null;
  bet: boolean;
  game: Record<string, unknown>;
}
export const MADE_LENGTHS: MadeIdea["length"][];
export interface MadeMenu {
  /** Each with the engine's own game of it on this season, when it fits one (`example`: the spec less where it runs), and the
   *  ways to win the engine takes for it (`wins`). */
  kinds: { id: string; name: string; says: string; example?: unknown; wins?: string[] }[];
  wins: { id: string; label: string; says: string }[];
  twists: string[];
  bets: string[];
}
export function madePrompt(o: { pack: Pack; manual: string; menu: MadeMenu; have?: { name: string; kind: string; length: string }[]; missing?: string[] }): string;
export function readIdeas(answer: string): MadeIdea[];
export function ideaDraft(idea: MadeIdea): Draft;
export function checkDraft(draft: Draft, o?: CheckOptions): CheckResult;
export const SPORT_GAME_LABELS: Record<string, string>;
export function checkAnswer(answer: string, o?: CheckOptions): AnswerResult;
export function withMoments(result: CheckResult, ratings: Record<string, MomentRating>, o?: { bar?: Reliability; pack?: Pack | null }): CheckResult;
export function numbersIn(text: string): Set<number>;
