-- A game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 1): "pre-merge and post-merge are separate games with their own
-- drafts, plus an overall winner", "a second draft at the merge". A game in stages is an ordinary league whose spec names its
-- stages (settings.stages) and how they add up (settings.stageOverall); each stage is a league of its own, an ordinary game the
-- engine plays exactly as it would alone, tied to it here, on the same couch and season with the same seats (src/lib/server/
-- stages.ts keeps them in step). The game's table is the overall, worked out on read from its stages' tables.
--
--   stage_of   the game in stages this league is a stage of (null for every other league)
--   stage_key  the stage's id in that game's spec (settings.stages[].id); set exactly when stage_of is
--
-- Deleting a game in stages deletes its stages with it. Additive for every existing row (all null).
ALTER TABLE leagues ADD COLUMN stage_of UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE leagues ADD COLUMN stage_key TEXT;
ALTER TABLE leagues ADD CONSTRAINT leagues_stage_key_with_stage_of CHECK ((stage_of IS NULL) = (stage_key IS NULL));
CREATE UNIQUE INDEX leagues_stage_of_key ON leagues (stage_of, stage_key) WHERE stage_of IS NOT NULL;
