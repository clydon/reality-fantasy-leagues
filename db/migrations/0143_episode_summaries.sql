-- Fill in what happened (src/lib/server/episode-fill.ts): a short summary of each aired episode of a show nobody's researched
-- (a game's results come through research; this is for a show you watch: "Rays 5, Brewers 3: Arozarena's two-run homer in the
-- 8th"). Shared by everyone on the season, asked once (our bot, else a pasted answer), and only ever shown to someone who has
-- seen that episode (season-episodes.ts, the spoiler guard's mark). Additive.
--
--   season_episodes.summary     what happened, a sentence or three; summary_at when it was filled in. Written on the listing's
--                               row when there is one; a row made for it is a 'listing' one, so the listings still update its
--                               air time and title.
--   episode_fills               one per season: the ask going now (asking_at; stale after a few minutes), who asked, and how the
--                               last one went (message when it failed, filled: how many it filled in).
ALTER TABLE season_episodes ADD COLUMN summary TEXT CHECK (length(summary) <= 1000);
ALTER TABLE season_episodes ADD COLUMN summary_at TIMESTAMPTZ;

CREATE TABLE episode_fills (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  asking_at TIMESTAMPTZ,
  asked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  message TEXT,
  filled INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
