-- Fill in who's playing (src/lib/server/rosters.ts): a sport's people. TV listings only list a sport's broadcasters (the World
-- Series: its reporters and analysts), so a sport nobody's made a game of had no one on its Players tab. Our bot (else a pasted
-- answer) gives each team's roster, its manager and coaches, and the officials; they're the season's cast, grouped by team.
-- Additive: only ever written to a sport's season with no cast yet, so a game's cast (Make it a game, the desk) is never touched.
--
--   season_cast.role   what someone does on their team, when the source says ("Pitcher", "Manager", "Home plate umpire"); NULL
--                      for every cast before this one.
--   cast_fills         one per season: the ask going now (asking_at; stale after a few minutes), who asked, how the last one went.
ALTER TABLE season_cast ADD COLUMN role TEXT CHECK (length(role) <= 60);

CREATE TABLE cast_fills (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  asking_at TIMESTAMPTZ,
  asked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  message TEXT,
  filled INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
