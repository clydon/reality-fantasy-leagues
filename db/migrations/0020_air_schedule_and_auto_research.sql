-- When a season's episodes air, and whether research runs on its own.
--
-- Air schedule: episodes air weekly from premiere_date (0006) at air_time, in air_tz. The wiki's own
-- per-episode air dates override the weekly guess once it has them (a double episode, a week off).
-- This is what tells the admin UI which episodes have aired -- only those can be researched -- and
-- it's the same clock the auto-research schedule below is read on.
ALTER TABLE show_seasons
  ADD COLUMN air_time TIME,
  ADD COLUMN air_tz TEXT NOT NULL DEFAULT 'America/New_York',
  -- Auto-research: once a week at research_weekday (0 = Sunday) / research_time, in air_tz, research
  -- the episode(s) that have aired since and not been researched. Off means the manual button only.
  ADD COLUMN auto_research BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN research_weekday SMALLINT CHECK (research_weekday BETWEEN 0 AND 6),
  ADD COLUMN research_time TIME,
  -- Which Claude model the schedule uses (the admin UI's picker is per-browser; a schedule needs its own).
  ADD COLUMN research_model TEXT,
  -- When auto-research was switched on. It only picks up episodes whose slot comes after this, so
  -- turning it on mid-season doesn't quietly pay to research every back episode at once.
  ADD COLUMN auto_research_since TIMESTAMPTZ;

-- Every scheduled attempt, so a failing one is retried at a sane pace rather than every hour, and the
-- admin UI can say why an episode that should have been researched wasn't.
CREATE TABLE auto_research_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok BOOLEAN NOT NULL,
  message TEXT
);
CREATE INDEX idx_auto_research_attempts ON auto_research_attempts(season_id, episode_number, attempted_at DESC);
