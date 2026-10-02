-- Scoreboard episode summaries: each player's one-line "why it mattered" for their own team's
-- episode, written by pasting an AI chat's reply back in (see
-- src/app/api/leagues/[leagueId]/episodes/[epId]/team-summary/route.ts).
--
-- A table rather than a key in leagues.state: it's free-text commentary, not game state, and every
-- player writes only their own row -- keeping it out of `state` means writing one never takes the
-- league lock or touches anyone else's game.

CREATE TABLE episode_team_notes (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  -- Matches an id inside leagues.state->'players' -- same convention as league_memberships.player_id
  -- and blind_draft_picks.player_id, not a foreign key, since players live in the JSONB blob.
  player_id TEXT NOT NULL,
  why_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, episode_number, player_id)
);
