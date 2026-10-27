-- Sports data from providers (docs/PLAN-sports-data.md steps 1 and 2; src/lib/server/sports/). Additive. Nothing here is backed up:
-- it's asked again from the provider (scripts/backup-leagues.js says so).
--
--   sports_cache    every provider answer, read into the provider shapes (a few KB each, never the raw answer), with how long it's
--                   good for (expires_at; NULL: for good, a finished game's box score). cache.ts says how long each kind keeps;
--                   the daily listings job prunes rows a week past their time.
--   sports_links    one per sport season: the provider and league its games are in (found from its listing's titles and dates,
--                   no table of sports), how many episodes are linked, what's still missing and why, when it was last looked at
--                   and when the daily listings job looks again (next_at: the next day while games are still to link, a week on
--                   when no provider has its games, an hour on when the provider didn't answer; sooner when its listing changes).
--   season_events   which provider event each episode shows (the World Series' Game 1 is ESPN's 401908042 in "baseball/mlb"),
--                   and the part of it, for an event in parts (an F1 weekend's race). The event's name, start and teams
--                   ([{ id, name }], the provider's; NULL for a field) as the provider gave them: step 3's cast comes from the
--                   linked games' teams. Gone with its episode.
CREATE TABLE sports_cache (
  key TEXT PRIMARY KEY CHECK (length(key) <= 300),
  value JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX sports_cache_expires ON sports_cache (expires_at);

CREATE TABLE sports_links (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  provider TEXT,
  league TEXT,
  linked INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE season_events (
  season_id UUID NOT NULL,
  episode INTEGER NOT NULL,
  provider TEXT NOT NULL,
  league TEXT NOT NULL,
  event_id TEXT NOT NULL,
  part TEXT,
  name TEXT,
  starts_at TIMESTAMPTZ,
  teams JSONB,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, episode),
  FOREIGN KEY (season_id, episode) REFERENCES season_episodes(season_id, number) ON DELETE CASCADE
);
CREATE INDEX season_events_event ON season_events (provider, league, event_id);
