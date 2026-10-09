// Types for the part of episode-research.js the Next app calls -- same arrangement as
// wiki-sync.d.ts: the implementation stays plain CommonJS so the CLI can require it under bare
// `node`, and TypeScript sees it through this file.
//
// The season-scoped entry points are what the admin research routes import; the league-scoped paste
// ones are what a commissioner's episode research route imports. researchEpisode (league-scoped, with
// a paid search) is CLI surface only.
import type { Pool } from "pg";
import type { BetAnswer, DecisionStageResult, EpisodeResearch, EpisodeResearchProvenance, ResearchAnswer, ResearchCoverage } from "@/lib/game/types";

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

/**
 * Read-only: assembles the same system+user instructions researchSeasonEpisode sends itself, joined
 * into one paste-able message, for an admin to run in their own web-searching AI chat instead of
 * paying for this app's search call. No model call, nothing written.
 */
export function buildPasteImportPrompt(
  pool: Pool,
  showSlug: string,
  season: number,
  episodeNumber: number,
  /** structured: ask for the checklist as JSON (schema + a pre-filled skeleton), parsed free of charge. */
  opts?: { structured?: boolean }
): Promise<{ prompt: string; castCount: number; betCount: number }>;

/**
 * The manual counterpart to researchSeasonEpisode: fits whatever free-text notes the admin pastes back
 * to the checklist schema with one cheap, non-search model call, then validates and stages it exactly
 * like a searched run. `opts.model` picks the structuring model (RESEARCH_MODELS); `force`/`provider`
 * don't apply here. `opts.structured` parses the notes as the checklist's JSON directly -- no model
 * call, no cost -- and throws (never falls back to the paid call) if they aren't. Throws if the notes
 * don't cover the cast.
 */
export function researchFromPaste(
  pool: Pool,
  showSlug: string,
  season: number,
  episodeNumber: number,
  notes: string,
  opts?: { model?: string; dry?: boolean; structured?: boolean }
): Promise<EpisodeResearchRun>;

/**
 * The commissioner panel's read: coverage for one episode of the league's season and, unless everyone
 * is settled, the JSON paste prompt narrowed to just who isn't. Read-only.
 */
export function leagueResearchStatus(
  pool: Pool,
  leagueId: string,
  episodeNumber: number
): Promise<{
  ctx: { showId: string; showSlug: string; showName: string; season: number; seasonId: string | null; castNames: string[] };
  coverage: ResearchCoverage;
  prompt: string | null;
  betCount: number;
}>;

/**
 * researchFromPaste for one league: JSON only, asked only about who the stored answers don't settle,
 * merged into them rather than replacing them, and staged as season decisions. Creates the season's
 * catalog row if the league's season had none. Throws if everyone is already settled.
 */
export function researchFromPasteForLeague(
  pool: Pool,
  leagueId: string,
  episodeNumber: number,
  notes: string
): Promise<EpisodeResearchRun & { coverage: ResearchCoverage }>;

/**
 * The research answer to one side bet, looked up by its wording. `researched` is false when the
 * episode has no research at all; `answer` is null when it has research that didn't settle this bet.
 */
export function storedBetAnswer(
  pool: Pool,
  args: { showId: string; season: number; episodeNumber: number; label: string }
): Promise<{ researched: boolean; researchedAt?: string; answer: BetAnswer | null }>;

/** Re-stages every episode already researched for a season from the stored answers (no search). */
export function stageCachedSeasonResearch(pool: Pool, seasonId: string): Promise<{ episodes: number; inserted: number }>;

export type { ResearchAnswer, ResearchCoverage };
