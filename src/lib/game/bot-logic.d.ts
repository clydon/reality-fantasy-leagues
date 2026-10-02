// Types for bot-logic.js (plain CommonJS, like action-items.js).
import type { LeagueState, Player } from "./types";

export interface BotRating {
  /** How likely they are to survive the next vote. */
  safety: number;
  /** What they're likely to score next episode (Active Roster). */
  points: number;
  /** What they're worth holding on a roster under this league's scoring. */
  value: number;
}

export type BotLevel = "casual" | "solid" | "sharp";
export interface BotLevelWeights {
  read: number;
  gut: number;
  swap: number;
}
export const LEVELS: Record<BotLevel, BotLevelWeights>;
export const DEFAULT_LEVEL: BotLevel;

export function isBot(player: Player | null | undefined): boolean;
export function botIds(state: LeagueState): string[];
export function ratings(state: LeagueState, level?: BotLevelWeights): Record<string, BotRating>;
/** Applies every waiting bot move to `state` in place; returns how many were made. */
export function run(state: LeagueState): number;
/** Whether any bot has a move waiting (including a blind-draft lock-in), without touching `state`. */
export function hasWork(state: LeagueState): boolean;
/** What each bot would lock in for an open blind draft that's waiting on it. */
export function blindSubmissions(state: LeagueState): { playerId: string; castawayIds: string[] }[];
