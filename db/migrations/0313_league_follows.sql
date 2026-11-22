-- Following a league (docs/PLAN-sports-couch.md A3; docs/design-round/league-follow-spec.md). Additive:
--
--   league_follows          a league someone follows ("football/nfl"): its card is on their Your shows, with no team needed. Following
--                           a team follows its league too (team-follows.ts), so this one table answers "is the NFL on my shows?";
--                           unfollowing a league takes its card off and leaves its teams followed. Its own table, not a league-wide
--                           row in team_follows: that table's key and its name, short and colour are a team's, and every reader of
--                           it (the couch's teams, the scores strip, the guide) reads its rows as teams.
--   team_follows.my_team    your team in a league: the first you followed there, changeable on the team's sheet; at most one a league
--                           (the partial unique index). Unfollowing it passes it to the next you followed there.
--
-- Carried over: every league someone follows a team in becomes a league follow (from their first team's day), and each person's
-- first team in a league becomes their team, so every card on Your shows stays where it is.
CREATE TABLE league_follows (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  league TEXT NOT NULL CHECK (league ~ '^[a-z0-9-]+/[a-z0-9.-]+$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, league)
);
CREATE INDEX idx_league_follows_league ON league_follows(league);

ALTER TABLE team_follows ADD COLUMN my_team BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX idx_team_follows_my_team ON team_follows(user_id, league) WHERE my_team;

INSERT INTO league_follows (user_id, league, created_at)
SELECT user_id, league, min(created_at) FROM team_follows GROUP BY user_id, league
ON CONFLICT (user_id, league) DO NOTHING;

UPDATE team_follows f SET my_team = true
  FROM (SELECT DISTINCT ON (user_id, league) user_id, league, team_id FROM team_follows ORDER BY user_id, league, created_at, team_id) firsts
 WHERE f.user_id = firsts.user_id AND f.league = firsts.league AND f.team_id = firsts.team_id;
