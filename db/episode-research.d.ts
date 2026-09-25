// Types for the part of episode-research.js the Next app calls -- same arrangement as
// wiki-sync.d.ts: the implementation stays plain CommonJS so the CLI can require it under bare
// `node`, and TypeScript sees it through this file.
//
// Only the season-scoped entry point is declared: it's what the admin research route imports. The
// league-scoped entry point is CLI surface only.
import type { Pool } from "pg";
import type { DecisionStageResult, EpisodeResearch, EpisodeResearchProvenance, ResearchAnswer } from "@/lib/game/types";

export interface EpisodeResearchOptions {
  /** Research it again even if this episode already has a row. */
  force?: boolean;
  /** Research and report, write nothing. */
  dry?: boolean;
  /** "anthropic" | "gemini" | "grok". Defaults to RESEARCH_PROVIDER, then anthropic. */
  provider?: string;
  /** Overrides the provider's default model. */
  model?: string;
}

/** The Claude models the admin UI may pick for research, cheapest first. */
export const RESEARCH_MODELS: string[];

/** What one episode's research produced, as the admin route reshapes it for the UI. */
export interface EpisodeResearchRun {
  showId: string;
  showSlug: string;
  showName: string;
  season: number;
  seasonId: string | null;
  episodeNumber: number;
  /** Where the list of people came from: the season's staged cast, or a league's own roster. */
  castFrom: "season" | "league";
  castNames: string[];
  terms: Record<string, string>;
  /** True when an existing row was reused -- no search, no model call, nothing charged. */
  cached: boolean;
  payload: EpisodeResearch;
  provenance: EpisodeResearchProvenance;
  /** The answers, deduplicated and with contradictions cleaned up. */
  entries: EpisodeResearch["castaways"];
  /** Non-fatal complaints a reviewer should see (unsourced claims, contradictions, strangers). */
  problems: string[];
  fatal: string[];
  counts: { castaways: number; unknowns: number; lowConfidence: number; sourced: number };
  /** What this run staged as season decisions for admin review. */
  decisions: DecisionStageResult;
}

/**
 * Research one episode of one catalogued season: asks a web-searching model a fixed checklist about
 * every castaway in the season's staged cast still in the game, validates coverage, and caches the answers in
 * `episode_research`. Throws if the season has no staged cast (there would be nobody to ask about),
 * if the provider has no credentials, or if the answer comes back missing people.
 */
export function researchSeasonEpisode(
  pool: Pool,
  showSlug: string,
  season: number,
  episodeNumber: number,
  opts?: EpisodeResearchOptions
): Promise<EpisodeResearchRun>;

/** Re-stages every episode already researched for a season from the stored answers (no search). */
export function stageCachedSeasonResearch(pool: Pool, seasonId: string): Promise<{ episodes: number; inserted: number }>;

export type { ResearchAnswer };
