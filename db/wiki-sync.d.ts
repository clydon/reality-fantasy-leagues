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

/**
 * Reads one (show, season)'s cast from the wiki once -- cache-aware, keyed on wiki revision ids --
 * then stages it into season_cast for admin review. Throws if the season can't be read (no catalog
 * entry, no wiki endpoint, no such section, a model/API failure).
 */
export function runForSeason(
  pool: Pool,
  showSlug: string,
  season: number,
  kind: "cast",
  opts?: WikiSyncOptions
): Promise<WikiSeasonSyncResult>;
