-- The bot's own call as an opponent (docs/PLAN-start-a-game-gpt.md step A14 part 2): a game of questions' question played against
-- the bot (its spec's `beat` { by: 'bot' }: "beat the bot: the AI makes its call too; you score when you're right and it's wrong")
-- has the bot's call on each window, made before the window's first lock from only what anyone could know then, graded by the same
-- data as everyone's answers (state-logic.js AnswerLogic, game-spec answers.js beatUnits). One call a window: per game, question and
-- episode, as game_answers' (0 for a question asked once for the game).
--
-- Kept out of the league's state and apart from game_answers on purpose: the bot is never a seat on the couch (no player_id, no
-- place on the table), and its call is hidden until the window locks, as everyone's answers are: every route returns the state
-- wholesale (0004's reason for blind_draft_picks), and the server reads these rows into the grade's facts (answer-points.ts
-- botCallsFor) only once their window's lock has passed. Changeable until then (the bot's run asks again); never after.
--
--   answer   as the question's kind takes it (a castaway id, or a list of them; a group id; 'yes' / 'no'; a number; 'over' /
--            'under'; an option), checked against what could be picked at the lock, as a seat's is (Spec.answerProblem)
--   note     the bot's reason in a line, as it gave it (or null)
--   made_by  'bot' (the bot's run asked it) or 'stand-in' (a check or a replay filed one in its place: never production's)
--
-- Additive: a table of its own, read a game at a time (the primary key's league_id leads).
CREATE TABLE bot_calls (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (question ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'),
  episode INTEGER NOT NULL CHECK (episode >= 0),
  answer JSONB NOT NULL CHECK (octet_length(answer::text) <= 2000),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  made_by TEXT NOT NULL DEFAULT 'bot' CHECK (made_by IN ('bot', 'stand-in')),
  made_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, question, episode)
);
