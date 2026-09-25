// Types for the part of wiki-sync.js the Next app calls. Same arrangement as
// src/lib/server/push-core.d.ts: the implementation stays plain CommonJS so the CLI can require it
// under bare `node`, and TypeScript sees it through this file.
//
// Only runForSeason is declared, because only runForSeason is imported from TypeScript -- everything
// else in that module is CLI/test surface and typing it here would be typing it for nobody.
import type { Pool } from "pg";
import type { WikiSeasonSyncResult } from "@/lib/game/types";

export interface WikiSyncOptions {
  /** Re-read the wiki even if its revision ids haven't changed since the cached extraction. */
  force?: boolean;
  /** Extract and report, write nothing. */
  dry?: boolean;
  /**
   * Set only by the nightly `all` run: suppresses a cast proposal that adds nobody new. An
   * explicitly requested pull leaves it off -- asking for it is the reason to see it.
   */
  batch?: boolean;
  /** Which Claude model reads the wiki (one of WIKI_MODELS). Defaults to WIKI_MODEL, then Opus. */
  model?: string;
}

/** The models the admin UI may pick for a wiki read, cheapest first. */
export const WIKI_MODELS: string[];

/** What one league's fan-out did, as the CLI logs it and the admin UI shows it. */
export interface FanOutResult {
  filed: boolean;
  summary: string;
  /**
   * Names the wiki used that this league's cast doesn't have. Non-fatal -- those decisions are
   * dropped and the rest still files -- but carried separately so a UI can say so without parsing
   * `summary`, because a dropped result is a hole in the season somebody should fix.
   */
  unmatched?: string[];
  /**
   * Results the validation threw out, with the reason. Each refusal is defensible on its own, but a
   * castaway whose ONLY result was dropped disappears from the review list -- so these are reported
   * rather than left as a console line.
   */
  dropped?: { name: string; episode: number; why: string }[];
  /** Pending items actually written. */
  written?: number;
}

/**
 * Fans one league's episode decisions out from the extraction already CACHED for its season -- no
 * wiki read, no model call. What a reveal runs after raising the league's catch-up pointer; the
 * episode gate itself lives in the fan-out, so re-running it is the whole of a reveal. Resolves to
 * null when nothing is cached for that season yet (the wiki hasn't been read since that episode
 * aired), which is not an error.
 */
export function fanOutCachedEpisodes(
  pool: Pool,
  league: { id: string; name: string; state: unknown },
  opts?: WikiSyncOptions & { silent?: boolean }
): Promise<FanOutResult | null>;

/**
 * Reads one (show, season) from the wiki once -- cache-aware, keyed on wiki revision ids -- then
 * fans the extraction out to every league tracking that season. Throws if the season itself can't
 * be read (no catalog entry, no wiki endpoint, no such section, a model/API failure); a single
 * league failing to resolve is reported in `leagues[].error` instead, so it can't deny the others.
 */
export function runForSeason(
  pool: Pool,
  showSlug: string,
  season: number,
  kind: "cast" | "episodes",
  opts?: WikiSyncOptions
): Promise<WikiSeasonSyncResult>;
