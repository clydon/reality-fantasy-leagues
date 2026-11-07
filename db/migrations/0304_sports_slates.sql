-- A league's slate: a season made of a whole league's games, several an episode (docs/PLAN-start-a-game-gpt.md track L, L8;
-- src/lib/sports/slate.ts, src/lib/server/sports/slate.ts). Additive but for two keys:
--
--   season_events   an episode links several events now (a day's, a week's or a round's games): its key is the episode and the
--                   event, where it was the episode alone. Every season before this links one an episode, so every row stays.
--                   A listing's season still links one an episode (link.ts replaces an episode's link rather than adding one).
--   game_lines      a player's line is an episode's and an event's (a week's games, a doubleheader's two): `event_id`, '' for the
--                   lines before this and for coming in (episode 0).
--   sports_slates   a slate is a season of its league's show, keyed by its league, season, stage and cadence
--                   ("espn:football/nfl:slate:2026:regular:week"), so everyone who asks for it shares one; `windows` is each
--                   episode's days ([[from, to], ...], the East's, both ends in it, tiling the stage), so a game listed later (a
--                   makeup, a moved game) finds its episode. Its games are linked as they near (the daily listings job: three days
--                   back to eight ahead), a soccer round's at once (its rounds need every fixture).
ALTER TABLE season_events DROP CONSTRAINT season_events_pkey;
ALTER TABLE season_events ADD PRIMARY KEY (season_id, episode, provider, league, event_id);

ALTER TABLE game_lines ADD COLUMN event_id TEXT NOT NULL DEFAULT '';
ALTER TABLE game_lines DROP CONSTRAINT game_lines_pkey;
ALTER TABLE game_lines ADD PRIMARY KEY (season_id, episode, provider, athlete, event_id);

CREATE TABLE sports_slates (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  league TEXT NOT NULL,
  season INTEGER NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('regular', 'post')),
  cadence TEXT NOT NULL CHECK (cadence IN ('day', 'week', 'round')),
  windows JSONB NOT NULL,
  key TEXT NOT NULL UNIQUE CHECK (length(key) <= 300),
  made_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  made_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);
