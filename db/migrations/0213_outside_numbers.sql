-- A number from a vetted outside source (docs/PLAN-start-a-game-gpt.md step A14 part 7; game-spec schema.js `settle: { by:
-- 'outside', take: 'rating', source: 'tvmaze', after }`): an episode's TVmaze rating, read once, `after` days after the episode
-- aired, and kept here, so every league on the season asking it the same way reads the same number and a later rating never
-- changes it (the Decisions table: "settled once at a fixed moment and stored, because outside numbers drift").
--
-- One row per season, episode, source, what and moment, written once by db/outside-numbers.js (an INSERT that never overwrites)
-- and never updated: either the number as the source had it then (value), or why there was none (why):
--   none       the source had no number for the episode then (TVmaze's rating needs enough votes): its question is void
--   unlisted   the season isn't linked to its TVmaze listing any more: void
--   unreached  the source couldn't be reached for days after the moment: void, so no game waits on it
-- Read on each read of a game that asks it (src/lib/server/outside-numbers.ts outsideNumbersFor), as the grader's facts.outside.
--
--   season_id   the season (show_seasons.id): a league's season is its settings' show and number
--   episode     the episode's number
--   source      where the number comes from ('tvmaze')
--   what        which number ('rating': the episode's rating.average, 0 to 10)
--   after_days  how many days after the episode aired it was read (the spec's `after`, 1 to 30)
--   value       the number, or null with `why`
--   read_at     when it was read
--
-- Additive: a table of its own, read a season at a time (its primary key leads with the season).
CREATE TABLE outside_numbers (
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  source TEXT NOT NULL CHECK (source IN ('tvmaze')),
  what TEXT NOT NULL CHECK (what IN ('rating')),
  after_days INTEGER NOT NULL CHECK (after_days BETWEEN 1 AND 30),
  value NUMERIC(6, 2) CHECK (value IS NULL OR value BETWEEN 0 AND 10),
  why TEXT CHECK (why IS NULL OR why IN ('none', 'unlisted', 'unreached')),
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, episode, source, what, after_days),
  CHECK ((value IS NULL) = (why IS NOT NULL))
);
