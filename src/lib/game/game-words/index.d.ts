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
  cast?: { id?: string; name: string; in?: boolean; out?: { episode: number; how?: string } | null; group?: string | null }[];
  ctx?: SpecContext | null;
  couch?: { people?: number | null; games?: { name: string; says?: string }[] } | null;
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
  cast: { id?: string; name: string; in: boolean; out?: { episode: number; how?: string }; group?: string }[];
  stillIn: number;
  moments: { id: string; says: string; points?: number | { exclusive: number; shared: number } }[];
  couchWordOnly?: { id: string; says: string }[];
  roles: string[];
  knows: Record<string, boolean>;
  couch: { people: number | null; games: { name: string; says?: string }[] } | null;
}

export interface Draft {
  game: Record<string, unknown> | null;
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
  fixed: { part: string; problem: string; from: unknown; to: Record<string, unknown>; options: string[] }[];
  dropped: { part: string | null; value: unknown; why: string; ours?: unknown }[];
  offers: { otherShow?: { show: string; season?: number }; second?: { summary: string }; moments?: { label: string; question: string; reliable: Reliability; why: string }[] };
  problems: { at: string; problem: string }[];
  waits: { at: string; step: string; problem: string }[];
}

export type AnswerResult = (CheckResult & { notes: string[]; botSummary: string }) | { state: "unreadable"; why: string; notes: string[] };

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
  /** A typed change: what the ask it changes said and assumed. */
  carry?: { said?: { part: string | null; quote: string }[]; assumed?: { part: string; value: unknown; why: string; by?: "bot" | "check" }[] } | null;
}

export const WORDS: Record<string, { what: string; values: Record<string, string>; sport?: string[]; show?: string[] }>;
export function manualFor(ctx: SpecContext | null, o?: { kind?: "show" | "sport"; examples?: unknown[]; limit?: number; show?: string | null }): string;
export const FIELDS: Record<string, string>;
export function fieldsOf(spec: unknown): Set<string>;
export function fieldExamples(ctx: SpecContext | null, rows: unknown[], o?: { show?: string | null }): Map<string, { words: string; spec: unknown }>;
export function examplesFor(ctx: SpecContext | null, rows: unknown[], o?: { limit?: number; cant?: number; show?: string; kind?: "show" | "sport" }): { playing: { words: string; spec: unknown; sentence: string }[]; waiting: { words: string; why: string }[] };
export function signature(spec: unknown): string;
export function packOf(input: PackInput): Pack;
export function idsOf(pack: Pack): Record<string, Set<string>>;
export function gamePrompt(o: { pack: Pack; manual: string; words: string }): string;
export function changePrompt(o: { pack: Pack; manual: string; words: string; spec: unknown; change: string }): string;
export function momentPrompt(o: { pack: Pack; moment: string }): string;
export function readDraft(answer: string): { draft: Draft; notes: string[] };
export function readMoment(answer: string): MomentRating;
export function checkDraft(draft: Draft, o?: CheckOptions): CheckResult;
export function checkAnswer(answer: string, o?: CheckOptions): AnswerResult;
export function withMoments(result: CheckResult, ratings: Record<string, MomentRating>, o?: { bar?: Reliability; pack?: Pack | null }): CheckResult;
export function numbersIn(text: string): Set<number>;
