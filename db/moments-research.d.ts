// Types for moments-research.js (a season's added moments' short ask, G1 part 4).
import type { Pool } from "pg";
import type { AddedMoment, MomentAnswer } from "../src/lib/game/formats/added-moments.js";

export interface MomentsAbout {
  showName: string;
  season: number;
  showId: string;
  episode: number;
  term: string;
  stored: boolean;
  title: string | null;
  cast: string[];
  moments: AddedMoment[];
  ask: AddedMoment[];
}
export const ASK_MS: number;
export function questionOf(m: { id: string; label?: string; question?: string | null }): string;
export function buildMomentsPrompt(o: { showName: string; season: number; episode: number; title?: string | null; cast?: string[]; term?: string; moments?: AddedMoment[] }): string;
export function parseMomentsAnswer(text: string, ids?: string[], cast?: string[]): { found: boolean; moments: Record<string, MomentAnswer> | null; episodeTitle: string | null; repairs: string[] };
export function momentsLine(moments: unknown, labels?: Record<string, string>): string;
export function aboutEpisode(pool: Pool, seasonId: string, n: number): Promise<MomentsAbout>;
export function storeMoments(pool: Pool, at: { showId: string; season: number; episode: number }, answers: Record<string, MomentAnswer>, note?: Record<string, unknown>): Promise<{ changed: string[] } | null>;
