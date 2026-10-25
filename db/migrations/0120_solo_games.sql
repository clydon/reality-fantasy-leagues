-- Playing solo (docs/PLAN-new-design.md step 9 part 3; the mock's solo.js): games that belong to no couch.
--
--   'public'   a season's public pool ("Survivor 51 · Everyone"): Survival Pool and a weekly Who goes home? call against
--              everyone on the app, usernames only, no chat. One per season, made by the first person to join it; nobody
--              runs it, and its results are the season's shared facts (the season sync reaches every league on a season).
--   'practice' someone's practice couch: them against three computer players (bot-logic.js) on one season, on the real
--              results. One per person and season; never counted toward a couch.
--
-- Both are ordinary leagues (couch_id NULL): the engine, the moves, the reveal and the season sync play them as they play any
-- game. solo_season_id says which season they were made for (a league otherwise names its season in state.settings), so the
-- one-per-season rules can be indexes. Additive: classic reads neither column.
ALTER TABLE leagues ADD COLUMN solo TEXT CHECK (solo IN ('public', 'practice'));
ALTER TABLE leagues ADD COLUMN solo_season_id UUID REFERENCES show_seasons(id) ON DELETE SET NULL;
-- A solo game is never a game on a couch (couches.ts healCouches leaves them alone).
ALTER TABLE leagues ADD CONSTRAINT leagues_solo_no_couch CHECK (solo IS NULL OR couch_id IS NULL);
CREATE UNIQUE INDEX idx_leagues_public_pool ON leagues(solo_season_id) WHERE solo = 'public';
CREATE UNIQUE INDEX idx_leagues_practice ON leagues(created_by, solo_season_id) WHERE solo = 'practice';
