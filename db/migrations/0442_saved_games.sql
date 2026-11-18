-- Saved games (docs/PLAN-start-a-game-redo.md B1; the user's note on Round 2, 2026-11-18: "a way to favorite games so you can repeat
-- it easily"): the heart beside Start on any game's screen keeps the game as its recipe on the account, so it opens again on any
-- season from Community and saved games. Additive. Renumber at merge if another branch took 0442 (master's last was 0441).
--
--   saved_games  one per person and recipe: its base (the gallery's catalog id), its rules without their dates (the spec, its span
--                left out), the length it was saved with (one episode, a stretch, the season), its name, where it came from (a
--                base, a community game, our AI, Run it back), and the season it was saved on, by its label (for "saved on
--                Survivor 51"). `key` is the recipe's identity (its base and its rules, stably written): saving the same game twice
--                is one save, and a changed game is another (the snapshot rule, decisions.md 2026-11-18).
CREATE TABLE saved_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  base TEXT NOT NULL,
  name TEXT NOT NULL,
  spec JSONB NOT NULL,
  length TEXT NOT NULL CHECK (length IN ('one', 'few', 'season')),
  made_from TEXT NOT NULL DEFAULT 'base' CHECK (made_from IN ('base', 'community', 'describe', 'saved', 'again')),
  saved_on TEXT NOT NULL DEFAULT '',
  season_id UUID REFERENCES show_seasons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
CREATE INDEX saved_games_user ON saved_games (user_id, created_at DESC);
