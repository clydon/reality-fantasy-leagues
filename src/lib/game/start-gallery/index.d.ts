import type { SpecContext } from "../game-spec/index.js";
import type { Pack } from "../game-words/index.js";

export type Spec = Record<string, unknown> & {
  preset?: string;
  span?: { from: number | { phase: string }; to: number | { phase: string } | null };
  get?: Record<string, unknown> & { by?: string; each?: number; order?: string; own?: string };
  count?: Record<string, unknown> | null;
  score?: Record<string, unknown> & { by?: string };
  rank?: Record<string, unknown> & { by?: string };
  ask?: Record<string, unknown>[];
  stages?: { id: string; name: string; game: Spec; on?: unknown; alongside?: boolean }[];
};

export interface Cat {
  id: string;
  short: string;
  name: string;
  says: string;
}

export interface Base {
  id: string;
  cat: string;
  also?: string;
  name: string;
  plain: string;
  about: string;
  effort: string;
  len: string;
  ref: string;
  coming?: string;
  needs?: string;
  from?: string;
  moment?: boolean;
  spec: Spec | null;
}

export interface PageFacts {
  ctx: SpecContext;
  from: number;
  left: number | null;
  later: { id: string; name: string }[];
  moments: { id: string; label?: string; answeredBy?: string }[];
  couchWord: string[];
  couch: number | null;
  pool: number | null;
  results: boolean;
  winner: boolean;
  grouped: boolean;
  votes: boolean;
  trivia: boolean;
  calls: boolean;
  sport: boolean;
  show: string;
  phases: { id: string; name?: string; summary?: string }[];
  properties: { key: string; name: string; values: string[] }[];
  lastSeason?: string;
}

export interface Verdict {
  ok: boolean;
  problems: string[];
  waits: string[];
  type: string | null;
  short: { title: string; line: string; more: number } | null;
  sentence: string | null;
  rules: string[] | null;
}

export type ControlKind = "segment" | "chips" | "stepper" | "switch" | "text" | "checklist";
export interface Control {
  id: string;
  label: string;
  kind: ControlKind;
  vocab?: string | null;
  options?: [unknown, string, string?][];
  other?: { min: number; max: number; step?: number };
  range?: [number, number];
  max?: number;
  def: unknown;
  more: boolean;
  value?: unknown;
}

export interface ChangeState {
  id: string;
  name: string;
  line: string;
  icon: string;
  on: boolean;
  why: string | null;
  coming: string | null;
  sheet: string | null;
  start: string | null;
  controls: Control[];
}

export interface Row {
  id: string;
  name: string;
  headline: boolean;
}

export interface QuestionKind {
  id: string;
  name: string;
  answer: string;
  settle: Record<string, unknown>;
  asked: string;
  points: number;
  moment?: boolean | string;
  needs?: string;
  sport?: boolean;
  closes?: string;
}

export const CATS: Cat[];
export const BASES: Base[];
export const SPORT: Base[];
export const ROWS: Row[];
export const CHANGES: { id: string; row: string; name: string; line: string; icon: string; kinds?: string[]; coming?: string; controls?: Control[] }[];
export const QUESTION_KINDS: QuestionKind[];
export const QUESTION_CONTROLS: Control[];

export function kindOf(spec: Spec | null): "draft" | "pick" | "card" | "squares" | "stages" | "questions";
export function expand(spec: Spec): Spec;
export function pageFacts(page: { ctx: SpecContext; pack: Pack } | SpecContext, extra?: Record<string, unknown>): PageFacts;
export function check(spec: Spec, pg: PageFacts): Verdict;
export function baseById(id: string): Base | null;
export function baseSpec(base: Base, span: { from: number | { phase: string }; to: number | { phase: string } | null } | null, pg?: PageFacts, moment?: string): Spec | null;
export function galleryFor(page: PageFacts, span?: { from: number; to: null }): { id: string; state: "plays" | "off" | "coming" | "needs"; why: string | null; short?: Verdict["short"]; fitted?: { each: number; to: number | "shared"; pool: number; people: number } | null }[];
export function playRow(spec: Spec): { name: string; headline: boolean };
export function changeStates(spec: Spec, row: string, pg: PageFacts): ChangeState[];
export function changeById(id: string): (typeof CHANGES)[number] | null;
export function applyChange(spec: Spec, id: string, pg: PageFacts): Spec;
export function dropChange(spec: Spec, id: string, pg: PageFacts): Spec;
export function setControl(spec: Spec, id: string, controlId: string, value: unknown, pg: PageFacts): Spec;
export function rowLine(row: string, spec: Spec, pg: PageFacts): string | null;
export function betOn(spec: Spec): boolean;
export function offBets(spec: Spec): Spec;
export function homesOf(): { key: string; value: string; row: string; change: string | null; control: string | null }[];
