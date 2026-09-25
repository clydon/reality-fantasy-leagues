-- Semantic search over the free-text half of episode research (db/episode-research.js), for
-- questions that aren't on the fixed checklist -- most immediately, suggesting an answer to a side
-- bet's free-text question ("Will Jenna find an idol?", "Who gets voted out first?"), which has no
-- fixed set of candidate answers the way the checklist's yes/no/unknown fields do.
--
-- This is deliberately NOT how episode_research_items (0015) works. That's an exact-match lookup
-- against structured fields (foundAdvantage === 'yes'), and a vector database adds nothing there --
-- see the README for why that's a mapper, not a search index. A side bet's question is arbitrary
-- prose with no structured field to match against, which is exactly the shape semantic search is
-- for: embed the question, embed the research text, find what's closest.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE episode_text_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  -- NULL for the whole-episode summary chunk; a name for a per-castaway note. Castaways nothing
  -- notable happened to get NO chunk at all (see db/embeddings.js's chunksFromResearch) -- a chunk
  -- that just says "nothing happened" would still score some nonzero similarity against an
  -- unrelated question and pollute the results, for zero information gained.
  castaway_name TEXT,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN ('summary', 'castaway_note')),
  text TEXT NOT NULL,
  -- 768 dims: gemini-embedding-001 defaults to 3072 but accepts a requested output_dimensionality,
  -- and 768 is the standard smaller size recommended for storage-cost-sensitive retrieval use --
  -- there is no evidence in this app's own tiny corpus (a season is dozens of rows) that the full
  -- 3072 dims would retrieve any better, and 4x the storage for it is not a trade worth making here.
  embedding vector(768) NOT NULL,
  -- Which embedding model produced this vector. Different models are NOT comparable in the same
  -- vector space, so if the model ever changes, mixed rows would silently return nonsense distances
  -- rather than an error -- recorded so that's at least detectable, and so a future re-embed can
  -- target only the stale rows.
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (show, season, episode, chunk_type, castaway_name) -- re-embedding (a --force
-- re-research) REPLACES rather than accumulates, same rule as wiki_extractions and episode_research.
-- COALESCE handles the summary chunk's NULL castaway_name, which a plain unique index would treat as
-- distinct from itself every time (Postgres's usual NULL-uniqueness trap) and let duplicate summary
-- chunks pile up on every re-embed.
CREATE UNIQUE INDEX idx_episode_text_chunks_identity
  ON episode_text_chunks (show_id, season_number, episode_number, chunk_type, COALESCE(castaway_name, ''));

-- No ANN index (ivfflat/hnsw) yet, deliberately: a season is dozens of chunks, and search is always
-- scoped to one episode's handful of rows by the query's own WHERE clause -- an index earns its cost
-- once there are thousands of rows to skip past, which this is nowhere near.
