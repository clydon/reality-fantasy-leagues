-- The Start-a-game GPT's asks (docs/PLAN-start-a-game-gpt.md step G1; src/lib/server/game-words.ts): each time someone's words
-- (or a typed change to a game the bot drafted) go to our bot, one row: who asked, on which season and couch, what they typed,
-- the bot's answer as it came and what our check made of it. It's the daily cap's count (GAME_ASKS_A_DAY a person, the desk
-- aside) and the record a later step measures the prompt on (how often a draft plays, what gets asked). No league reads it.
--
--   change_of  the ask this one changes (its words and game the bot was given), or null for a first ask
--   words      what they typed first (a change's row repeats its first ask's words)
--   change     the change they typed, on a change's row
--   answer     the bot's answer, raw; null while it's asking or when it didn't answer
--   result     our check's result (game-words check.js checkAnswer, the reliability asks folded in); null until then
--   seconds    how long the bot took, all of its asks together
--   error      why there's no answer (the bot down or cut off)
--
-- Additive: a table of its own.
CREATE TABLE game_word_asks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  change_of UUID REFERENCES game_word_asks(id) ON DELETE SET NULL,
  words TEXT NOT NULL CHECK (char_length(words) BETWEEN 1 AND 2000),
  change TEXT CHECK (change IS NULL OR char_length(change) BETWEEN 1 AND 2000),
  answer TEXT,
  result JSONB,
  seconds REAL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((change_of IS NULL) = (change IS NULL))
);
CREATE INDEX game_word_asks_user_day ON game_word_asks (user_id, created_at DESC);
