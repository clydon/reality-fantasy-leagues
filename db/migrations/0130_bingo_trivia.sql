-- Bingo and trivia (docs/PLAN-new-design.md step 12 part 3; the mock's index.html bingoSheet and triviaSheet, rulebook.js Weekly
-- Bingo). Additive, and classic reads none of it.
--
-- A bingo card is one person's, for one episode of one season, whichever couch they're on (as a call is): nine squares in a three
-- by three, the centre free, drawn from the show's moments (bingo.ts) when it's first opened and kept as they were, so a later
-- rulebook change never reshuffles a card. `squares` is [{ key, label }], key 'free' or 'm:<moment>' (the moment's event id, as
-- the season's results record it; a talk show's moment id), as Call it's questions are keyed.
CREATE TABLE bingo_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  squares JSONB NOT NULL CHECK (jsonb_typeof(squares) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_id, episode)
);
-- An episode's cards (the couch's, once you've seen it), and a season's for Weekly Bingo's table.
CREATE INDEX bingo_cards_episode ON bingo_cards (season_id, episode);

-- A square ticked while watching: from the episode's airtime on. Shown to nobody else until they've seen the episode. A square
-- counts once it happened (the season's results; a talk show's, the couch saying so, where a mark from someone who's seen the
-- episode is their say), and a line counts once all three of its squares do.
CREATE TABLE bingo_marks (
  card_id UUID NOT NULL REFERENCES bingo_cards(id) ON DELETE CASCADE,
  square SMALLINT NOT NULL CHECK (square BETWEEN 0 AND 8),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, square)
);

-- A trivia round played: one a week per person and show (`week`, the Monday it's for), three questions from the seasons of the
-- show they've seen (trivia.ts), the first play counted. `season_id` is the season the round is named for; `answers` is
-- { [question]: option }. Only the score is shown to anyone else on the couch.
CREATE TABLE trivia_plays (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  week DATE NOT NULL,
  season_id UUID REFERENCES show_seasons(id) ON DELETE SET NULL,
  score SMALLINT NOT NULL CHECK (score >= 0),
  questions SMALLINT NOT NULL CHECK (questions > 0 AND score <= questions),
  answers JSONB NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, show_id, week)
);
CREATE INDEX trivia_plays_week ON trivia_plays (show_id, week);
