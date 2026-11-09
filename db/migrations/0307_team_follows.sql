-- Sports on the couch (docs/PLAN-start-a-game-gpt.md U1, "U1 sports on the couch's calls", 2026-11-09). Additive:
--
--   team_follows                         a team someone follows from its sheet (Follow), by the provider's league path and team
--                                        id ("football/nfl", "21"). The couch's teams are those anyone on the couch follows, plus
--                                        those in games it plays; they lead the guide's Sports. Following adds no game by itself.
--                                        The team's name, short name, abbreviation, logo and colour are kept as they were when
--                                        followed, so the guide draws them without a list read (refreshed on each follow).
--   user_settings.hide_sports_scores     "Sports scores too", under Hide scores: a sports game that has begun says only when it
--                                        started (never live or final, its clock, period, overtime, score, winner or a team's
--                                        record) until that person taps its Show the score. Off by default: sports stay live.
CREATE TABLE team_follows (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  league TEXT NOT NULL CHECK (league ~ '^[a-z0-9-]+/[a-z0-9.-]+$'),
  team_id TEXT NOT NULL CHECK (length(team_id) BETWEEN 1 AND 40),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  short TEXT NOT NULL CHECK (length(short) BETWEEN 1 AND 80),
  abbreviation TEXT CHECK (length(abbreviation) <= 12),
  logo TEXT CHECK (length(logo) <= 500),
  color TEXT CHECK (color ~ '^[0-9a-fA-F]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, league, team_id)
);
CREATE INDEX idx_team_follows_team ON team_follows(league, team_id);

ALTER TABLE user_settings ADD COLUMN hide_sports_scores BOOLEAN NOT NULL DEFAULT false;
