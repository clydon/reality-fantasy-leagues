// Types for waiver-words.js (plain CommonJS so the server's push code can require it).
import type { LeagueState, WaiverPeriod } from "./types";

/** "Swap 1" / "Swap up to 2" / "Swap any" ("" for none). */
export function swapPhrase(n: number, roster: number): string;
/** "Replace who's out · Swap up to 2": what a waiver window allows, with no names. */
export function windowLine(state: LeagueState, period: Pick<WaiverPeriod, "swaps" | "replace" | "window">): string;
