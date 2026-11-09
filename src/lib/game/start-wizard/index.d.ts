// Types for Start a game's wizard logic (index.js; docs/PLAN-start-a-game-gpt.md U1).
import type { SpecContext, SpecDescription, SpecSpan } from "../game-spec/index.js";
import type { Pack } from "../game-words/index.js";

export type Span = { from: SpecSpan["from"]; to: SpecSpan["to"] };
/** A spec as the engine rolls it (loose: the engine's own shapes). */
export type Spec = Record<string, unknown> & {
  get?: { by?: string; each?: number; own?: string };
  count?: { start?: number; best?: number } | null;
  score?: Record<string, unknown> & { by?: string; captain?: { times?: number }; bank?: { start: number } };
  ask?: { id: string; ask: string; answer: string; points?: number; asked?: string; wager?: number | "total"; odds?: string; card?: unknown }[];
  span?: Span;
};

export interface WizardInput {
  page: { ctx: SpecContext; pack: Pack };
  /** The next episode to air. */
  first: number;
  /** The season's last episode, when known. */
  last: number | null;
  /** The listing's episodes, when the last isn't known. */
  listed?: number[];
  /** The rulebook's phases in order, each with the episode it starts at when that's known. */
  phases: { id: string; name: string; starts?: number | null }[];
  part: { singular: string; plural: string };
  /** "Survivor 51". */
  label: string;
  /** The next episode's own word when it isn't its number ("tonight", "Wednesday"). */
  tonight?: string | null;
  /** Kinds this show can play (rulebook-fits), when only some. */
  only?: string[];
  short?: number;
}

export interface Stage {
  id: string;
  label: string;
  span: Span;
  /** Its edges are episodes (not a phase nobody can date yet). */
  exact: boolean;
}

export interface Timing {
  first: number;
  last: number | null;
  pre: boolean;
  season: Span;
  tonight: Span;
  mode: "tonight" | "season";
  stages: Stage[];
  episodes: number[];
}

export interface Row {
  id: string;
  kind: "standard" | "shuffle" | "typed";
  /** Its kind of game (KINDS' id). */
  game: string;
  name: string;
  role?: string;
  win: string;
  spec: Spec;
  describe: SpecDescription;
  seed?: string;
}

export interface Added {
  id: string;
  says: string;
  pts: number;
}

export interface Choice {
  sel: string;
  row?: Row | null;
  win: string;
  tws: string[];
  bet: string;
  cnt: { each?: number; play?: number };
  scoring: "standard" | "no-loss" | "big";
  edits: Record<string, number>;
  off: string[];
  qedits: Record<string, number>;
  added: Added[];
}

export interface Built {
  row: Row;
  win: string;
  r: { ok: boolean; spec: Spec | null; describe: SpecDescription | null; why: string | null; seed?: string | number };
  keep: Spec;
}

export interface Step {
  key: "before" | "each" | "win";
  label: string;
  words: string;
  draw: { kind: string; n: number; k: number };
}

export type Outcome = { choice: Choice; toast?: string; step?: string; why?: never; creative?: never } | { why: string; choice?: never; creative?: never } | { creative: true; choice?: never; why?: never };

export interface Wizard {
  games(span: Span): { list: Row[]; classic: string | null; easy: string | null; n: number | null };
  build(span: Span, choice: Choice): Built | null;
  options(span: Span, choice: Choice): { wins: Record<string, { ok: boolean; why?: string }>; tws: Record<string, { ok: true; times?: number }>; bets: string[] };
  winOk(span: Span, choice: Choice, w: string): { ok: boolean; why?: string };
  twistOk(span: Span, choice: Choice, id: string): { ok: true; times?: number } | null;
  bets(span: Span, choice: Choice): string[];
  nameOf(span: Span, choice: Choice): string;
  changes(span: Span, choice: Choice): string[];
  scoringName(span: Span, choice: Choice): string;
  scoreLine(span: Span, choice: Choice): string;
  scoreRows(
    span: Span,
    choice: Choice
  ):
    | { kind: "moments"; rows: { id: string; says: string; pts: number; on: boolean; was: number; changed: boolean; added: boolean; base: number }[] }
    | { kind: "questions"; rows: { id: string; says: string; asked?: string; pts: number; wager?: number | "total"; odds?: string }[]; bank: number | null; parlay: number | null }
    | { kind: "survive" | "place" | "card" | "other"; rows: never[] };
  setMoment(span: Span, choice: Choice, id: string, on: boolean, pts: number): Outcome;
  setQuestion(span: Span, choice: Choice, id: string, v: number): Outcome;
  setCount(span: Span, choice: Choice, which: "each" | "play", v: number): Outcome;
  scorings(span: Span, choice: Choice): string[];
  quick(span: Span, choice: Choice, ai?: string): { id: "comp" | "casual" | "score" | "creative"; label: string; next: string; off: boolean }[];
  applyQuick(span: Span, choice: Choice, kind: "comp" | "casual" | "score" | "creative"): Outcome;
  shuffle(span: Span, choice: Choice, locks: { game?: boolean; win?: boolean } | null, n: number): Outcome;
  typed(span: Span, spec: unknown, name?: string): Outcome;
  nextLine(span: Span, spec: Spec | null, when?: (n: number) => string | null): string;
  steps(spec: Spec): Step[];
  plainLine(spec: Spec): string;
}

export const KINDS: { id: string; name: string; says: (part: string) => string; base: string }[];
export const WINS: { id: string; roll: string; label: string; says: (part: string) => string }[];
export const TWISTS: Record<string, { id: string; step: "before" | "each" | "win"; group: string; label: string; says: string }>;
export const TWIST_GROUPS: string[];
export const MONEY: Record<string, [string, string]>;
export const SCORINGS: Record<string, { name: string; says: (show: string) => string }>;
export function fresh(): Omit<Choice, "sel" | "row">;
export function timing(input: WizardInput): Timing;
export function sayRange(span: Span, input: WizardInput): string;
export function nTag(span: Span, input: WizardInput): string;
export function nOf(span: Span, input: WizardInput): number | null;
export function normalSpan(span: Span, input: WizardInput): Span;
export function steps(spec: Spec, input: WizardInput): Step[];
export function plainLine(spec: Spec, input: WizardInput): string;
export function twistLabel(id: string, times?: number): string;
export function scoreKind(spec: Spec): string;
export function moneyOf(keep: Spec): Record<string, Spec>;
export function keepOf(spec: Spec): Spec;
export function createWizard(input: WizardInput): Wizard;
export function choiceKey(c: Choice): string;
