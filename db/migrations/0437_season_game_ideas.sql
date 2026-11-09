-- G5: a season's made-for games (docs/PLAN-start-a-game-gpt.md G5; src/lib/server/made-games.ts). One row a season, shared by
-- every couch on it: the ideas that passed our check, each a whole game the wizard's rail offers. Making them again replaces
-- the row; a failed ask keeps the ideas there were and says why.
--
-- Additive: a new table.
CREATE TABLE IF NOT EXISTS season_game_ideas (
  season_id uuid PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- What was asked and how it went: the AI, its seconds, how many it wrote and how many our check passed.
  asked jsonb,
  made_by text REFERENCES "user"(id) ON DELETE SET NULL,
  made_at timestamptz,
  error text
);
