-- The draft room's queue (docs/PLAN-new-design.md step 7; the mock's draft.js): the castaways a player starred on the
-- board, in order, so they're ready when it's their turn, and what the pick timer takes from when it runs out and the
-- game says "pick from their queue" (off by default: casual drafts wait). Additive.
--
-- Kept out of leagues.state for the reason blind_draft_picks is (0004): state goes to every member whole, and who you're
-- eyeing is yours until you pick them. Read back only for your own seat (src/lib/server/draft.ts); the timer's pick
-- reads it inside the league's lock. A row stays after the draft (a handful of ids); it goes with the league.
CREATE TABLE draft_queues (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  -- An id inside leagues.state->'players', as blind_draft_picks.player_id.
  player_id TEXT NOT NULL,
  castaway_ids JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, player_id)
);
