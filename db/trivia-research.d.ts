// Types for the part of trivia-research.js the Next app calls (the desk's Research and the bot: a run's question).
import type { Pool } from "pg";

export interface TriviaAbout {
  showName: string;
  season: number;
  term?: string;
  cast: { name: string; out: number | null }[];
}
/** Who's in the season and when each left, for a trivia run about episode `n`. */
export function castFor(pool: Pool, seasonId: string, n: number): Promise<TriviaAbout>;
/** Trivia's question: questions about episode `episode` and the season so far. */
export function buildTriviaPrompt(o: TriviaAbout & { episode: number; airedAt?: string | null }): string;
