// Types for bingo-research.js (bingo's bank: the prompt, the parse, the context and the store), plain CommonJS so the bot's run
// can require it under bare `node`; TypeScript sees it through this file.
import type { Pool } from "pg";
import type { Likelihood } from "@/lib/game/bingo";

export const ASKED: number;
export const MIN_BANK: number;
export const MAX_LABEL: number;
export const NAMED: number;

export type EpisodeKind = "premiere" | "regular" | "finale" | "reunion";
export function episodeKind(o: { n: number; count?: number | null; title?: string | null; note?: string | null }): EpisodeKind;

export interface BingoPhase {
  name: string;
  starts?: { type: string; n?: number };
  summary?: string;
}
export function phaseLines(phases: BingoPhase[], n: number, stillIn: number | null): string[];

export interface BingoContext {
  showName: string;
  season: number;
  kind: string;
  part: { singular: string; plural: string };
  premise: string | null;
  count: number | null;
  phases: BingoPhase[];
  term: string;
  avoid: string[];
  cast: string[];
  /** null: the season's own bank. */
  episode: number | null;
  airAt?: string | null;
  title?: string | null;
  note?: string | null;
  stillIn?: string[];
}
export function buildBingoPrompt(ctx: Partial<BingoContext> & { showName: string; season: number }): string;

export interface ParsedSquare {
  label: string;
  likelihood: Likelihood;
  status: "live" | "dropped";
  note: string | null;
}
export function parseBingoAnswer(text: string, opts?: { avoid?: string[]; names?: string[]; anyone?: boolean }): { squares: ParsedSquare[]; skipped: number };

export const BOT_MIN: number;
export interface CheckVerdict {
  seen: boolean;
  likely: boolean;
  scoring: boolean;
  spoiler: boolean;
  sameAs: number | null;
  likelihood: Likelihood | null;
  note: string | null;
}
export function buildCheckPrompt(o: { showName: string; season: number; part?: { singular: string; plural: string }; episode?: number | null; squares: { label: string; likelihood: string }[]; avoid?: string[] }): string;
export function parseCheckAnswer(text: string, count: number): (CheckVerdict | null)[];
export function judged(squares: ParsedSquare[], checks: (CheckVerdict | null)[]): ParsedSquare[];
export function hasBank(pool: Pool, seasonId: string, episode: number | null): Promise<boolean>;

export function bingoContext(
  pool: Pool,
  seasonId: string,
  episode: number | null,
  opts?: { airAt?: string | null; title?: string | null; note?: string | null }
): Promise<BingoContext>;
export function storeBank(pool: Pool, seasonId: string, episode: number | null, squares: ParsedSquare[], runId?: string | null): Promise<number>;
