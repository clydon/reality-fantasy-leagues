-- Answers to a game's questions (docs/PLAN-start-a-game-gpt.md step A4): a game of questions' (league type 'questions':
-- its spec's `ask`, settings.questions), one per player, question and episode (0 for a question asked once for the game).
-- Additive, and classic reads none of it.
--
-- Per game, as a lineup or a pick is: the league's own players (player_id, its state's), so a late joiner or a computer
-- player has a seat like anyone. Private until the question locks (its episode's start, closedForPlay: src/lib/server/
-- answers.ts never shows anyone else's before then), changeable until it does. Graded on read from the league's own results
-- (state-logic.js AnswerLogic, game-spec answers.js): no grade is stored, so a corrected result regrades everyone. A draft's
-- finale predictions stay in its state (state.finalePredictions, as classic writes them); Weekly Calls' calls are Call it's,
-- a person's (episode_calls).
CREATE TABLE game_answers (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL CHECK (char_length(player_id) BETWEEN 1 AND 100),
  question TEXT NOT NULL CHECK (question ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'),
  episode INTEGER NOT NULL CHECK (episode >= 0),
  -- As the question's kind takes it: a castaway id (or a list of them), 'yes' / 'no', a number, 'over' / 'under', an option.
  answer JSONB NOT NULL CHECK (octet_length(answer::text) <= 2000),
  -- Who wrote it (themselves; nobody answers for someone else).
  answered_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, player_id, question, episode)
);
-- Read a game at a time (answer-points.ts storedAnswers): the primary key's league_id leads, so no index of its own.
