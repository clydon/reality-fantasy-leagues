-- I'm watching, for sports (docs/PLAN-sports-couch.md C2, the lone fan; docs/design-round/lone-fan-spec.md "Watching marks"): one
-- tap on a game's sheet puts your face on that game's rows for your couch until it's final. Presence, like a show's watch along:
-- shown only on that couch, only for someone sharing When I'm watching (user_settings.share_where). A row a person, couch and game;
-- a game's rows matter only while it's on, so the read takes the last day's and nothing sweeps them (a few a person a week).
CREATE TABLE IF NOT EXISTS sports_watching (
  couch_id uuid NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  game_id text NOT NULL CHECK (length(game_id) <= 64),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  league text NOT NULL CHECK (length(league) <= 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couch_id, game_id, user_id)
);
CREATE INDEX IF NOT EXISTS sports_watching_couch_league ON sports_watching (couch_id, league, created_at);
