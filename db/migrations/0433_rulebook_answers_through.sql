-- Research on a rulebook through an episode (docs/PLAN-rulebook-research.md): someone watching a season that has already
-- aired asks Check for changes or What scores as of where they are, so the answer describes nothing later. The answer
-- keeps the episode it was asked through (null: the whole season), for its card. The run carries it as desk_runs.episode_number.
--
-- Additive: a nullable column.
ALTER TABLE rulebook_answers ADD COLUMN through_episode INTEGER;
