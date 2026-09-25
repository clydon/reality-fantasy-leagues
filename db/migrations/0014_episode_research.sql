-- Per-episode research, gathered by asking a model a fixed checklist WITH WEB SEARCH rather than by
-- parsing the wiki's tables.
--
-- Why a second source at all. The wiki's tables are excellent for what they hold -- who went home,
-- who won immunity, who voted for whom -- and useless for everything else. Who found an idol, who
-- sat out a challenge, who had an advantage played against them: none of that is in a column, and
-- the table-driven connector correctly reports nothing for it (see docs/RESEARCH-extractable-stats.md,
-- tier D). Those are exactly the moments a fantasy league wants to score.
--
-- So this is a deliberately different tradeoff from wiki_extractions, and the two are kept apart
-- rather than merged:
--
--   wiki_extractions  -- derived from a table we fetched. Reproducible, high trust, no sources
--                        needed beyond the page revision.
--   episode_research  -- derived from a web search. NOT reproducible (a later search returns
--                        different pages), so every answer carries its own sources and confidence,
--                        and nothing here is trusted without a human saying so.
--
-- Per EPISODE, not per season, for two reasons: a search is naturally scoped to one episode ("who
-- found an idol in Survivor 51 episode 3"), and a season in progress then costs one episode's
-- research per week instead of re-researching the whole season.
CREATE TABLE episode_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  -- The checklist answers, one entry per castaway (see EpisodeResearchSchema in
  -- db/episode-research.js). Every castaway appears whether or not anything happened to them --
  -- coverage by construction, which is the whole reason for a checklist over free extraction.
  payload JSONB NOT NULL,
  -- Model, timestamp, the search queries it ran and every URL it actually read. This is the
  -- substitute for "which revision of which page did this come from", and it is what a reviewer
  -- checks against -- so it is not optional metadata, it is the point.
  provenance JSONB NOT NULL,
  researched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (show, season, episode): re-researching an episode replaces what was there rather
-- than accumulating, same rule wiki_extractions follows for its own cache.
CREATE UNIQUE INDEX episode_research_key ON episode_research (show_id, season_number, episode_number);
