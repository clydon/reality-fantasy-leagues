-- Postponed, suspended and moved games, and which line a question plays by (docs/PLAN-start-a-game-gpt.md track L, L3 part 3b).
-- Additive:
--
--   sports_events.called   why a game the provider lists as over wasn't played, as its status names it: 'postponed' (its makeup,
--                          when there is one, a game of its own: ESPN's STATUS_POSTPONED), 'canceled' (never made up:
--                          STATUS_CANCELED), or 'suspended' (stopped, to be finished later: the same game, kept as being played).
--                          NULL for every game played, still to play, or read before this (a postponed one then reads as called
--                          off all the same: state 'post', not final).
--   question_lines         the line an over/under on a game's total plays by (a spec's `line: 'game'`): the latest line read for
--                          its game when the question first opened for answers in a league, kept once and never changed, so every
--                          answer is graded against the line shown with it. One row a league, question, window and game (an
--                          episode's one game: event_id ''; a question about each game: each game's own id). `read_at` is when
--                          that line was read from the provider (sports_events.odds_at).
ALTER TABLE sports_events ADD COLUMN called TEXT CHECK (called IN ('postponed', 'canceled', 'suspended'));

CREATE TABLE question_lines (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (question ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'),
  episode INTEGER NOT NULL CHECK (episode >= 0),
  event_id TEXT NOT NULL DEFAULT '' CHECK (length(event_id) <= 64),
  line NUMERIC(8, 2) NOT NULL,
  read_at TIMESTAMPTZ,
  stamped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, question, episode, event_id)
);
