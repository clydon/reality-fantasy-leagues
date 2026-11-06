-- The players' vote on a format change (docs/PLAN-start-a-game-gpt.md step A14 part 1): a game in stages whose stage a format change
-- starts (or a side stage) and whose spec says the players take the change (extras.changes.ok 'vote') waits for its seats to vote,
-- until the lock of the episode the new stage would start with (src/lib/server/change-stages.ts voteChange, the stage-changes route).
-- One vote a seat a change, changeable until the vote's decided.
--
-- Kept out of the league's state on purpose: every route returns the state wholesale, so a vote kept there would be readable from
-- anyone's Network tab before it's decided (0004's reason for blind_draft_picks), and answers that depend on each other stay hidden
-- until the lock. Only the decision is the state's (state.changeStages.decided, by 'vote', once more than half of the seats say the
-- same); a vote the lock decides is counted from these rows on each settle (StateLogic.StageLogic.changePlan's input), every row
-- cast before the lock, so nobody joining or leaving afterwards moves it.
--
--   change_key  the copy's key the change would start (`<stage id>@<the change's id>`, StageLogic.copyKey)
--   player_id   the seat (a player in leagues.state; a team two share votes once, as either of them)
--   vote        start | skip
--   user_id     who cast it (null once their account is deleted)
--
-- Additive: a table of its own, read a game at a time (the primary key's league_id leads).
CREATE TABLE stage_change_votes (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  change_key TEXT NOT NULL CHECK (char_length(change_key) BETWEEN 1 AND 200),
  player_id TEXT NOT NULL CHECK (char_length(player_id) BETWEEN 1 AND 100),
  vote TEXT NOT NULL CHECK (vote IN ('start', 'skip')),
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, change_key, player_id)
);
