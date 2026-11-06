-- A card the bot chooses (docs/PLAN-start-a-game-gpt.md step C7 part 2; game-spec schema.js `card: { from: 'bot' }`): before each
-- episode, bot research's card run (db/card-research.js) asks the bot to rank the moments the season's cards are drawn from (every
-- such game's list, together) for that episode: best first, and those that can't happen in it. One ask for the season, so every
-- game on it reads the same choice, each card taking the first of its own list in that order (schema.js rankedLines).
--
-- Every answer is kept: `status` 'live' when it passed its check (each moment one it was asked about, none twice, at least one
-- ranked, asked before the card was out), 'dropped' with `note` saying why. And 'fallback': the card came out without a choice
-- (Spec.CARD_OUT_HOURS before the episode airs, or at once for an episode whose air time isn't known), filed by the first read after
-- that (db/card-research.js stampLeague). An episode's card is its first decided row, live or fallback, oldest first: so once it's
-- out it never changes (a choice made after the fallback, or an air date moved, changes nothing players have answered). Public once
-- made (a card's lines are what players answer or pick for), so each league's episodes are stamped with it as the air times are
-- (src/lib/server/card-choices.ts); this table is what they're stamped from.
--
--   asked     the moments the bot was asked to rank (ids), as the season's cards had them then
--   moments   its ranking, best first (ids, each one of `asked`)
--   cannot    those it said can't happen that episode (ids, each one of `asked`, none of `moments`)
--   made_by   'bot' (the card run), 'app' (a fallback: the read that found the card out without a choice) or 'stand-in' (a check
--             or a replay filed one in the bot's place: never production's)
--
-- Additive: a table of its own, read a season at a time; and the card run's kind on bot_research_runs' check (every kind already
-- allowed listed: 0204's).
CREATE TABLE card_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  asked JSONB NOT NULL CHECK (jsonb_typeof(asked) = 'array' AND octet_length(asked::text) <= 4000),
  moments JSONB NOT NULL CHECK (jsonb_typeof(moments) = 'array' AND octet_length(moments::text) <= 4000),
  cannot JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(cannot) = 'array' AND octet_length(cannot::text) <= 4000),
  status TEXT NOT NULL CHECK (status IN ('live', 'dropped', 'fallback')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  made_by TEXT NOT NULL DEFAULT 'bot' CHECK (made_by IN ('bot', 'app', 'stand-in')),
  run_id UUID REFERENCES bot_research_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX card_choices_season ON card_choices (season_id, episode, created_at);

ALTER TABLE bot_research_runs DROP CONSTRAINT bot_research_runs_kind_check;
ALTER TABLE bot_research_runs ADD CONSTRAINT bot_research_runs_kind_check
  CHECK (kind IN ('quick', 'full', 'schedule', 'tiebreak', 'rulebook', 'trivia', 'bingo', 'facts', 'card'));
