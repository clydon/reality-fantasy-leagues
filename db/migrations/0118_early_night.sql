-- The morning update's "so far → final" (docs/PLAN-new-design.md step 8; the mock's stages.js finalUpdate): what someone's
-- Weekly Lineup stood at when they revealed an episode early (0109's early_seen), so once its final scores land the show
-- space can say "So far last night +14 › Final +22", who added what this morning, and how the table moved, rather than
-- playing the whole reveal again. Set with early_seen by the new design's reveal (season-episodes.ts revealSeason) and
-- cleared with it: { leagueId, total, starters: [{ name, points }], table: [{ playerId, place, rank, total }] } for the
-- first Weekly Lineup on the couch's season, at most a dozen small rows. NULL for nothing waiting (every row today).
-- Additive.
ALTER TABLE show_follows ADD COLUMN early_night JSONB;
