// Types for the part of embeddings.js the Next app calls -- same arrangement as episode-research.d.ts
// and wiki-sync.d.ts: the implementation stays plain CommonJS, TypeScript sees it through this file.
//
// Only suggestAnswer and getEpisodeSummaryText are declared, because only those are imported from
// TypeScript (the suggested-answer and team-summary routes). Everything else (storeChunksForEpisode, searchChunks, chunksFromResearch)
// is called from db/episode-research.js and test scripts, both plain CommonJS already.
import type { Pool } from "pg";

export type SuggestedAnswerStatus =
  /** This episode has never been researched -- there's no text to search yet. */
  | "no-research"
  /** There's research, but nothing matched the question well enough to trust. */
  | "unconfident"
  /** A match cleared the confidence floor -- `answer` and `confidence` are populated. */
  | "ok";

export interface SuggestedAnswer {
  status: SuggestedAnswerStatus;
  /** The closest research chunk's text, verbatim -- never a fabricated summary. Null unless status is 'ok'. */
  answer: string | null;
  confidence: "high" | "medium" | null;
  /** Who the matched chunk was about, if it was a per-castaway note rather than the episode summary. */
  castawayName: string | null;
  /** The raw cosine similarity behind the confidence label, for debugging/tuning -- not shown to end users. */
  similarity: number | null;
}

/**
 * Semantic search for one free-text question ("Will Jenna find an idol?"), scoped to one episode's
 * research. Never fabricates an answer: returns the closest matching chunk of REAL research text
 * with a confidence, or explains why there isn't one ('no-research' vs 'unconfident'). Throws only on
 * a real infrastructure failure (no embedding credentials, the API unreachable) -- not on finding
 * nothing, which is `status: "unconfident"`, a normal result.
 */
export function suggestAnswer(
  pool: Pool,
  args: { showId: string; season: number; episodeNumber: number; question: string }
): Promise<SuggestedAnswer>;

/** The episode's stored research summary text, verbatim (exact lookup, no embedding call); null if none. */
export function getEpisodeSummaryText(
  pool: Pool,
  args: { showId: string; season: number; episodeNumber: number }
): Promise<string | null>;
