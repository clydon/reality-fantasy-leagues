-- Keeping up with a show you follow (src/lib/server/keep-up.ts). Additive: every reader keeps working with these at their
-- defaults, and seen_through stays the one mark the spoiler guard reads.
--
--   show_follows.keep_up    how where you are moves as episodes air, on a season you follow and don't play (one you play moves
--                           with your games' reveals):
--                             'off'   only when you move it (the stepper, a watch along's End, rating an episode)
--                             'ask'   Live: when each new episode ends, Tonight asks "Seen it?"; nothing opens until you say
--                             'auto'  moves itself to each episode as it airs (Settings, with its spoiler warning): seen_through
--                                     is written forward by keep-up.ts, on your own reads and on the bot clock for everyone
--   show_follows.not_yet    Live's "Not yet": the episode you said you haven't seen, so Tonight doesn't ask again until a
--                           newer one ends. Cleared by moving where you are.
ALTER TABLE show_follows ADD COLUMN keep_up TEXT NOT NULL DEFAULT 'off' CHECK (keep_up IN ('off', 'ask', 'auto'));
ALTER TABLE show_follows ADD COLUMN not_yet INTEGER CHECK (not_yet > 0);
CREATE INDEX idx_show_follows_auto ON show_follows(season_id) WHERE keep_up = 'auto';
