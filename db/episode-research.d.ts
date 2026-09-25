// Types for the part of episode-research.js the Next app calls -- same arrangement as
// wiki-sync.d.ts: the implementation stays plain CommonJS so the CLI can require it under bare
// `node`, and TypeScript sees it through this file.
//
// The season-scoped entry point and the reveal-time fan-out are declared because both are imported
// from TypeScript (the admin research route, and reveal-next). The league-scoped entry point is CLI
// surface only.
import type { Pool } from "pg";
import type { EpisodeResearch, EpisodeResearchProvenance, ResearchAnswer } from "@/lib/game/types";

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

/** One league's fan-out result -- the research connector's analogue of wiki-sync's FanOutResult. */
export interface ResearchFanOutResult {
  id: string;
  name: string;
  ok: boolean;
  /** True when this league hasn't revealed far enough to see the episode yet (nothing was written). */
  held?: boolean;
  /** New pending items filed. */
  filed?: number;
  /** Existing pending items whose confidence/sources/research_id were refreshed. */
  updated?: number;
  /** True on a --dry run: `filed` is what WOULD have been written. */
  dry?: boolean;
  error?: string;
}

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
  /** One entry per league tracking this season -- the items this run staged, filtered by each
   * league's own reveal gate. Empty on a --dry run (nothing was staged to check). */
  leagues: ResearchFanOutResult[];
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

/**
 * Re-stages one already-cached episode's research for a single league -- the research connector's
 * analogue of wiki-sync's fanOutCachedEpisodes. What reveal-next runs after raising a catching-up
 * league's pointer: items a research run already produced but this league was gated from seeing
 * become visible without paying for the search again. Resolves to null when nothing has been
 * researched for that episode yet, which is not an error.
 */
export function fanOutCachedResearch(
  pool: Pool,
  league: { id: string; name: string; state: unknown },
  episodeNumber: number
): Promise<ResearchFanOutResult | null>;

export type { ResearchAnswer };
