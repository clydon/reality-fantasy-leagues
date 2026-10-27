-- A sport's stats (src/lib/server/rosters.ts): each person's numbers, as snapshots, for the Players tab. Any sport: the columns are
-- whatever its box scores use (AVG and HR, ERA and K, laps and points), chosen by the answer, never a list kept here. Additive.
--
--   cast_stats         one row per person per snapshot. `through` 0 is coming in (the regular season, a career, qualifying:
--                      whatever came before this season or series, never a spoiler); `through` N is this season or series through
--                      episode N. The tab shows coming in, and the newest snapshot at or before where you are (the spoiler guard's
--                      mark), so stats past an episode never reach someone who hasn't seen it. `label` says what coming in covers
--                      ("2026 regular season"); `items` is [{ label, value }], at most a handful, as the answer gave them.
--   stat_fills         one per season: the ask going now (asking_at; stale after a few minutes), who asked, how the last one went.
CREATE TABLE cast_stats (
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  through INTEGER NOT NULL CHECK (through >= 0),
  label TEXT CHECK (length(label) <= 80),
  items JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cast_stats_once ON cast_stats (season_id, lower(name), through);

CREATE TABLE stat_fills (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  asking_at TIMESTAMPTZ,
  asked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  message TEXT,
  through INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
