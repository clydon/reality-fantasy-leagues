-- Per-person progress and following (docs/PLAN-new-design.md step 0b): where someone is in a show season and
-- whether they follow it, a fact about them and the season rather than about a league.
--
-- seen_through is the last episode they've seen the results of: what the spoiler guard
-- (src/lib/server/guard.ts) lets them read up to, 0 when nothing is known (fail closed). For a season they
-- play, it follows their leagues: league_memberships.results_seen_through stays the classic app's mark, and
-- every classic write of it also moves this one forward (src/lib/server/follows.ts), so the two designs
-- never disagree. That column is dropped at step C.
--
-- private: they watch it privately, so their couches don't see it (guard.ts shares()).
CREATE TABLE show_follows (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  seen_through INTEGER NOT NULL DEFAULT 0 CHECK (seen_through >= 0),
  following BOOLEAN NOT NULL DEFAULT true,
  private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);
CREATE INDEX idx_show_follows_season ON show_follows(season_id);
