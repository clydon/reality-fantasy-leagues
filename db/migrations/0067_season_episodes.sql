-- When each episode actually airs and how long it runs, as research confirmed it. Each full research run asks
-- about the NEXT episode ("next time on...", the network's schedule): a week off for a holiday, a double or
-- extra-long episode, a new night. db/episode-research.js recordNextEpisode writes it here.
--
-- It's the table docs/PLAN-new-design.md step 0b planned (season_episodes: per-episode air time and runtime);
-- 0b extends it rather than making another.
CREATE TABLE season_episodes (
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number > 0),
  -- The exact start, when known.
  air_at TIMESTAMPTZ,
  runtime_min INTEGER CHECK (runtime_min BETWEEN 1 AND 600),
  -- Anything unusual, in a few words ("two-hour finale", "after a week off for Thanksgiving").
  note TEXT,
  -- research: from an episode's research (reported_in says which); admin: set by hand, never overwritten by research.
  source TEXT NOT NULL DEFAULT 'research' CHECK (source IN ('research', 'admin')),
  reported_in INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, number)
);

-- Every season's air dates in the one map src/lib/game/air-schedule.js episodeAirTime reads: the wiki's
-- printed dates ("March 5, 2026"), with research-confirmed exact starts (ISO, UTC) over them for the same
-- episode. Lineup locks, reminders, waivers, auto-research and the bot clock all read air times through it.
-- `runtimes` is each confirmed episode's length in minutes.
CREATE VIEW season_air_dates AS
SELECT ss.id AS season_id,
       COALESCE((SELECT jsonb_object_agg(e->>'number', e->>'airDate')
                   FROM wiki_extractions we, jsonb_array_elements(we.payload->'episodes') e
                  WHERE we.show_id = ss.show_id AND we.season_number = ss.season_number AND we.kind = 'episodes'
                    AND e->>'airDate' IS NOT NULL), '{}'::jsonb)
       || COALESCE((SELECT jsonb_object_agg(se.number::text, to_char(se.air_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                      FROM season_episodes se
                     WHERE se.season_id = ss.id AND se.air_at IS NOT NULL), '{}'::jsonb) AS air_dates,
       COALESCE((SELECT jsonb_object_agg(se.number::text, se.runtime_min)
                   FROM season_episodes se
                  WHERE se.season_id = ss.id AND se.runtime_min IS NOT NULL), '{}'::jsonb) AS runtimes
  FROM show_seasons ss;
