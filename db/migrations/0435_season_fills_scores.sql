-- Getting it ready gets a step (docs/PLAN-rulebook-research.md): what scores, every moment of the season's rulebook priced on
-- the ladder by our bot once how it's played is in, before who's in it. The first prompt no longer suggests numbers.
--
-- Additive: a check widened on 0160's table.
ALTER TABLE season_fills DROP CONSTRAINT IF EXISTS season_fills_step_check;
ALTER TABLE season_fills ADD CONSTRAINT season_fills_step_check CHECK (step IN ('rules', 'scores', 'cast', 'episodes'));
