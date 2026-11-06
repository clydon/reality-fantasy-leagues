-- The bot's own call as an opponent, asked (docs/PLAN-start-a-game-gpt.md step A14 part 2b; db/call-research.js): bot research's call
-- run makes the bot's call on each window of a game's questions played against it before the window locks, filed in bot_calls (0206,
-- made_by 'bot'). Its runs are rows of bot_research_runs like every other run's: kind 'call', slot 'call:<league id>', episode_number
-- the episode whose start locks the windows it calls (asked once: the game's first).
--
-- Only the kind check changes: every kind already allowed (0208's list) and 'call'.
ALTER TABLE bot_research_runs DROP CONSTRAINT bot_research_runs_kind_check;
ALTER TABLE bot_research_runs ADD CONSTRAINT bot_research_runs_kind_check
  CHECK (kind IN ('quick', 'full', 'schedule', 'tiebreak', 'rulebook', 'trivia', 'bingo', 'facts', 'card', 'call'));
