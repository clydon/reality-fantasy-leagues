-- How long a season's episodes run, in minutes. Bot research counts its schedule from when an episode ENDS
-- (db/bot-research.js): "quick check 5 minutes after" used to mean five minutes into a live 90-minute
-- Survivor, long before anyone had written who went home. Null means an hour. Set per season in Admin >
-- season > Setup > Bot research. (The new design's per-episode runtimes, season_episodes.runtime_min in
-- docs/PLAN-new-design.md step 0b, will refine it for finales.)
ALTER TABLE show_seasons ADD COLUMN episode_minutes INTEGER CHECK (episode_minutes BETWEEN 1 AND 600);
