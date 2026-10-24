-- Bot research gets a third kind of run, "schedule": after an episode ends, the bot asks only when the NEXT one
-- airs, its start time and its length, and files that in season_episodes (0067). It stages no results, so there's
-- nothing to review (db/bot-research.js buildSchedulePrompt / runJob).
ALTER TABLE bot_research_runs DROP CONSTRAINT bot_research_runs_kind_check;
ALTER TABLE bot_research_runs ADD CONSTRAINT bot_research_runs_kind_check CHECK (kind IN ('quick', 'full', 'schedule'));
