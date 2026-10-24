-- The schedule's foundation for the new design's guide (docs/PLAN-new-design.md step 0b), on top of 0067's
-- season_episodes.
--
-- No weekly rows are stored: a guessed date in season_episodes would sit over the wiki's real one in the
-- season_air_dates view, which every lineup lock, reminder and bot check reads, and would go stale when the
-- premiere or air time changes. The weekly guess stays computed (air-schedule.js episodeAirTime), and
-- src/lib/server/schedule.ts lists a season's episodes from it, the wiki and these rows together.

-- An episode's title when an admin or research gives one; otherwise the wiki's (schedule.ts reads both).
ALTER TABLE season_episodes ADD COLUMN title TEXT;

-- How a season airs: weekly (every show today), nightly, or binge (every episode at drop_at, a streaming
-- drop; step 14). episodeAirTime takes both; until a nightly or binge season exists, nothing else reads them.
ALTER TABLE show_seasons
  ADD COLUMN release TEXT NOT NULL DEFAULT 'weekly' CHECK (release IN ('weekly', 'nightly', 'binge')),
  ADD COLUMN drop_at TIMESTAMPTZ;

-- What kind of show it is, the same four kinds a rulebook has (R1): which games fit it and which tabs it gets.
-- Inferred when a show is set up (step 10), never asked; every show today is a competition.
ALTER TABLE shows
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'competition' CHECK (kind IN ('competition', 'series', 'talk', 'sport'));
