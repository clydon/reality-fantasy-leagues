-- Couches you join, and games you ask to join (docs/PLAN-new-design.md step 9). Additive: classic reads neither.
--
-- Why someone is on a couch. Until step 9 everyone was there because they play one of its games ('game': 0101's
-- backfill, classic's joins, healCouches), and classic takes them off once they're in none of its games. Now someone
-- can be on a couch in its own right ('couch': they started it, joined it with its invite code, or were taken out of
-- its games in the new design, where they stay on the couch), and only leaving the couch takes them off.
ALTER TABLE couch_members ADD COLUMN via TEXT NOT NULL DEFAULT 'game' CHECK (via IN ('game', 'couch'));

-- "Ask me first" (a game's Who can join, in league settings as joinMode): someone on the couch asks to join a game,
-- whoever runs it lets them in or declines (quietly), and a let-in is theirs to use once (they choose where to start and
-- pick their team themselves). One open request per person and game.
CREATE TABLE game_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set when it's answered: let in (until they join, then 'joined'), declined, or taken back by whoever asked.
  decided_at TIMESTAMPTZ,
  decided_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  outcome TEXT CHECK (outcome IN ('let-in', 'declined', 'withdrawn', 'joined'))
);
CREATE UNIQUE INDEX idx_game_join_requests_open ON game_join_requests(league_id, user_id) WHERE decided_at IS NULL;
CREATE INDEX idx_game_join_requests_league ON game_join_requests(league_id, created_at DESC);
