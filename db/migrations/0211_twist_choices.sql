-- The top scorer's twist (docs/PLAN-start-a-game-gpt.md step A14 part 5; game-spec schema.js `score.twist`): after each episode's
-- final results its top scorer chooses one of the game's twists for the next episode only. The choice is kept here, one row an
-- episode, while it's open: who made it and which twist (filed false). Once the choice closes (the spec's hours before the episode
-- airs, or when it locks or has results; at once for a game at your own pace), the first read or write files what the episode plays
-- (src/lib/server/twists.ts, StateLogic.TwistLogic.file): the choice, if whoever made it still chooses by the data then, else the
-- spec's fallback (filed true, `how` saying which), and from then on it stands: a choice made after it, or a result corrected after
-- it, changes nothing that episode played.
--
-- Kept out of the league's state on purpose while it's open: every route returns the state wholesale, so a choice kept there would
-- be readable from anyone's Network tab before it closes (0004's reason for blind_draft_picks). Once filed it's stamped on the
-- league's episode (`episode.twist`: { id, by, how }), as public as the air times, for the scoring to read.
--
--   episode    the episode the twist plays in (its number)
--   player_id  who chose it (a seat in leagues.state); filed with how 'fallback', null
--   twist      the twist's id (one of the spec's); filed with how 'fallback', the fallback's, or null for none
--   filed      false while the choice is open; true once the episode's twist is settled
--   how        once filed: 'chosen' (the choice stood) or 'fallback'
--
-- Additive: a table of its own, read a game at a time (its primary key leads with the league).
CREATE TABLE twist_choices (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  player_id TEXT CHECK (player_id IS NULL OR char_length(player_id) BETWEEN 1 AND 100),
  twist TEXT CHECK (twist IS NULL OR char_length(twist) BETWEEN 1 AND 40),
  filed BOOLEAN NOT NULL DEFAULT false,
  how TEXT CHECK (how IS NULL OR how IN ('chosen', 'fallback')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, episode),
  CHECK (filed OR (player_id IS NOT NULL AND twist IS NOT NULL AND how IS NULL)),
  CHECK (NOT filed OR how IS NOT NULL)
);
