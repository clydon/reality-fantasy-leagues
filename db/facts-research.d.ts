// Types for the part of facts-research.js the Next app calls (the desk's Research: a run's question).
import type { Pool } from "pg";
import type { EpisodeFactsSection, FactId } from "../src/lib/game/formats/episode-facts.js";

export interface FactsAbout {
  showName: string;
  season: number;
  showId: string;
  episode: number;
  term: string;
  /** Research has stored its answer for the episode (the full run's, or a paste). */
  stored: boolean;
  title: string | null;
  cast: string[];
  section: EpisodeFactsSection | null;
  /** The facts its section isn't sure of: the ones the run asks. */
  ask: FactId[];
}
export function unsureIn(section: EpisodeFactsSection | null): FactId[];
/** What a facts run about episode `n` reads. */
export function factsFor(pool: Pool, seasonId: string, n: number): Promise<FactsAbout>;
/** The facts run's question. */
export function buildFactsPrompt(o: { showName: string; season: number; episode: number; title?: string | null; cast?: string[]; term?: string; facts?: FactId[] }): string;
export function parseFactsAnswer(text: string, facts?: FactId[]): { found: boolean; episodeFacts: Partial<EpisodeFactsSection> | null; episodeTitle: string | null; repairs: string[] };
export function factsLine(section: unknown): string;
