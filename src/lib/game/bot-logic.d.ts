// Types for bot-logic.js (plain CommonJS, like action-items.js).
import type { LeagueState, Player, WaiverClaim, WaiverPeriod } from "./types";

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
/** A game at your own pace: every catching-up bot plays each week up to episode `n` on its own copy, then its mark is `n`.
 *  Returns how many moves were made. */
export function catchUpTo(state: LeagueState, n: number): number;
/** A game at your own pace with teams: each computer player with none picks its own from who was in before its start. */
export function paceTeams(state: LeagueState): number;
/** What each bot would lock in for an open blind draft that's waiting on it. */
export function blindSubmissions(state: LeagueState): { playerId: string; castawayIds: string[] }[];
/** What each bot would bid in an open auction that's waiting on it (step A10 part 3b). */
export function auctionBids(state: LeagueState): { playerId: string; bids: { castawayId: string; bid: number }[] }[];
/** What a bot claims for a waiver week, asked for when the week processes (claims live outside state). */
export function waiverClaim(state: LeagueState, playerId: string, period: WaiverPeriod | null): WaiverClaim;
/** Fills each bot's empty group slots for the current episode (step A10 part 1, since A11 part 5c); returns how many it filled. */
export function groupSlotPicks(state: LeagueState): number;

/** E1b: the answer kinds computer players give (start-gallery/index.js botsFit keeps the same list). */
export const ANSWERS: string[];
/** Whether a computer player answers this question. */
export function answersQuestion(q: unknown): boolean;
/** Whether computer players play every question this game asks. */
export function answersAll(state: LeagueState): boolean;
/** The questions a computer player answers into game_answers. */
export function answeredQuestions(state: LeagueState): unknown[];
/** The answers computer players would give now (the server writes them into game_answers: bots.ts). */
export function answers(state: LeagueState, stored: { playerId: string; question: string; episode: number }[], o?: { now?: number; finale?: number | null; rooms?: Map<string, StakeRoom> }): { playerId: string; question: string; episode: number; answer: unknown }[];
/** At your own pace: the answers each catching-up computer player gives as it reaches each week, through the week after `n` (null:
 *  its own mark), each on its own copy before that week (call before catchUpTo). */
export function catchUpAnswers(state: LeagueState, stored: { playerId: string; question: string; episode: number }[], n: number | null, rooms?: Map<string, StakeRoom>): { playerId: string; question: string; episode: number; answer: unknown }[];
/** A seat's room to stake (answer-points.ts seatStakeRoom), keyed "seat|live" or "seat|mark". */
export type StakeRoom = { points: number; held: Map<string, number> };
/** The weeks each catching-up computer player answers for, through the week after `n` (null: its own mark). */
export function catchUpWeeks(state: LeagueState, n: number | null): { playerId: string; week: number }[];
/** Whether any question computer players answer is staked from points or a bank (the server reads their rooms for those). */
export function stakesPoints(state: LeagueState): boolean;
