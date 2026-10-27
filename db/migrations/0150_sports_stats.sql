-- A sport's stats from its linked games' box scores (docs/PLAN-sports-data.md step 4; src/lib/server/sports/stats.ts). Additive.
--
--   game_lines                  each player's line in each of a season's linked games, as the provider gave it: its own tables and
--                               columns (a hitter's batting, a pitcher's pitching, an AFL player's one table; a race's place, from
--                               its scoreboard), keyed by the provider's id for them (season_cast.provider_ids). `episode` is the
--                               game's episode. Episode 0 is coming in: their season line from before this began (the regular
--                               season, for games in a postseason; else the season before), `label` saying which ("2026 regular
--                               season"), [] when the provider had none. A finished game's lines never change. The Players tab
--                               (rosters.ts) adds up only the games you've seen, so nothing past your mark reaches you.
--   season_events.lines_at      when its game's lines were last read; lines_final: they're in and final, never read again.
--   season_cast.shown_from      the episode whose box score brought someone in (a team the provider has no roster for: AFL's on
--                               ESPN). The Players tab shows them once you've seen it. NULL: from a roster, a field, or another
--                               way, shown to anyone.
--
-- cast_stats (0145, our bot's snapshots) is no longer read: ChatGPT never fills in stats (the plan's decisions). stat_fills is
-- now the sports stats fill's hold.
CREATE TABLE game_lines (
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode >= 0),
  provider TEXT NOT NULL,
  athlete TEXT NOT NULL,
  name TEXT NOT NULL,
  team TEXT,
  label TEXT CHECK (length(label) <= 80),
  tables JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, episode, provider, athlete)
);

ALTER TABLE season_events ADD COLUMN lines_at TIMESTAMPTZ, ADD COLUMN lines_final BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE season_cast ADD COLUMN shown_from INTEGER;
