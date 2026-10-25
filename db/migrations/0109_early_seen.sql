-- Results in stages (docs/PLAN-new-design.md step 2): an episode's early results (who went home) can come in before
-- its final scores (every scoring moment). early_seen is the episode someone revealed while only its early results
-- were in, until they've seen its final scores: the show space then says "Final scores are in" once (the morning
-- update), which spoils nothing they haven't revealed. NULL for nothing waiting, which is every row today: a classic
-- reveal never sets it, and everything revealed before stages existed was final.
ALTER TABLE show_follows ADD COLUMN early_seen INTEGER CHECK (early_seen > 0);
