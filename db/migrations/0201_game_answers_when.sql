-- When a game's answer was made (docs/PLAN-start-a-game-gpt.md step A9: a call whose points shrink with time). Additive: every
-- existing answer reads as made before its game started, with no changes, which is how they've always scored.
--
--   late     how many of the game's episodes had started when the answer was last changed (src/lib/server/answers.ts, from
--            StateLogic.AnswerLogic.started): a call that stays open once the game is on (asked once, closing at the finale)
--            can shrink by it, the earlier the better (game-spec answers.js shrunk)
--   changes  how many times it was changed once the game had started ("seal a winner pick before the premiere; every change
--            costs a point"): a first answer made then counts as one, so waiting never beats sealing it early; answering the
--            same again isn't a change
ALTER TABLE game_answers
  ADD COLUMN late INTEGER NOT NULL DEFAULT 0 CHECK (late >= 0),
  ADD COLUMN changes INTEGER NOT NULL DEFAULT 0 CHECK (changes >= 0);
