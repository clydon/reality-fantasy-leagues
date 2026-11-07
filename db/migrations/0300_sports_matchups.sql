-- Games straight from a team's schedule, as a season of their own, and each game's final and line kept (docs/PLAN-start-a-game-gpt.md
-- track L, L1 part 3; src/lib/server/sports/matchup.ts, src/lib/sports/matchup.ts). Additive. Nothing here is backed up beyond
-- what a season already is: sports_events is asked again from the provider if lost.
--
--   sports_events    one row per provider event any season links (a matchup's or a TV listing's: season_events), shared by them
--                    all: its name and start, its state, its sides ([{ id, name, abbreviation, home, score, winner }]), and once
--                    it's final, its final (final, final_at: the sides never change after). `odds` is the sportsbook's line before
--                    it ({ provider, details, overUnder, spread }: DraftKings' "PHI -2.5" and 237.5, the over/under's default
--                    line), taken from the scoreboard while the game is still to play and kept once it starts; for a game seen
--                    only after, from its summary (ESPN's pickcenter). Written when a matchup is made and by the daily listings
--                    job for linked games from three days back to a week ahead (one scoreboard per league and day, cached).
--   sports_matchups  a season made from a schedule, keyed by its games: `key` is the provider, league and its event ids sorted
--                    ("espn:basketball/nba:401909093"), so everyone who asks for the same games shares one season.
--   shows.sports_league  the show a league's matchups are seasons of ("espn:basketball/nba": "NBA"), one per league; NULL for
--                    every other show.
CREATE TABLE sports_events (
  provider TEXT NOT NULL,
  league TEXT NOT NULL,
  event_id TEXT NOT NULL,
  name TEXT CHECK (length(name) <= 200),
  starts_at TIMESTAMPTZ,
  state TEXT NOT NULL CHECK (state IN ('pre', 'in', 'post')),
  teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  final BOOLEAN NOT NULL DEFAULT false,
  final_at TIMESTAMPTZ,
  odds JSONB,
  odds_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, league, event_id)
);

CREATE TABLE sports_matchups (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  league TEXT NOT NULL,
  events TEXT[] NOT NULL CHECK (cardinality(events) BETWEEN 1 AND 30),
  key TEXT NOT NULL UNIQUE CHECK (length(key) <= 600),
  made_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  made_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shows ADD COLUMN sports_league TEXT;
CREATE UNIQUE INDEX shows_sports_league ON shows (sports_league) WHERE sports_league IS NOT NULL;
