-- Researched trivia (db/trivia-research.js; src/lib/server/trivia.ts). Additive, but for trivia_plays' key (below): a round
-- asks these first and fills the gaps with the questions it works out from the results (src/lib/game/trivia.ts), as before.
--
-- A day before each episode airs, the bot writes a few questions about the one before it and the season so far (bot research's
-- 'trivia' run), and a second prompt checks each against the episode's recaps. Every question it wrote is kept: `status` 'live'
-- when it passed its checks, 'dropped' with `note` saying why (shown on the admin episode page). `made_after` is the latest
-- episode that had aired when it was written, `episode` the one it's about (no later): nobody is asked one until they've seen
-- `episode`. A new run for the same `made_after` replaces that batch.
CREATE TABLE trivia_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  made_after INTEGER NOT NULL CHECK (made_after > 0),
  episode INTEGER NOT NULL CHECK (episode > 0 AND episode <= made_after),
  kind TEXT NOT NULL CHECK (kind IN ('cast', 'number', 'text')),
  question TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  answer TEXT NOT NULL,
  why TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('live', 'dropped')),
  note TEXT,
  run_id UUID REFERENCES bot_research_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trivia_questions_season ON trivia_questions (season_id, made_after);

-- "This question's wrong": hidden from whoever says so straight away, and from everyone once two people have (or an admin has).
CREATE TABLE trivia_flags (
  question_id UUID NOT NULL REFERENCES trivia_questions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

ALTER TABLE bot_research_runs DROP CONSTRAINT bot_research_runs_kind_check;
ALTER TABLE bot_research_runs ADD CONSTRAINT bot_research_runs_kind_check
  CHECK (kind IN ('quick', 'full', 'schedule', 'tiebreak', 'rulebook', 'trivia'));

-- A round was a show's week. Now it can also be a batch of researched questions written in the last week (src/lib/server/
-- trivia.ts): one a day before each episode, so a show that airs most nights has several. `round` is '' for a week's round
-- (every play before this one) and '<season>:<made_after>' for a batch's, played once whatever week it's in.
ALTER TABLE trivia_plays ADD COLUMN round TEXT NOT NULL DEFAULT '';
ALTER TABLE trivia_plays DROP CONSTRAINT trivia_plays_pkey;
ALTER TABLE trivia_plays ADD PRIMARY KEY (user_id, show_id, week, round);
CREATE INDEX trivia_plays_round ON trivia_plays (show_id, round) WHERE round <> '';
