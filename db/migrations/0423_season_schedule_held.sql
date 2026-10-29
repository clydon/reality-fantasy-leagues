-- A season's schedule set by hand wins over its TV listing's (docs/PLAN-desk-parity.md step 3, part 3b; Noticed b). A season
-- made from (or linked to) its listing has every episode's start as a season_episodes row (source 'listing'), and those
-- exact starts sit over the weekly guess from premiere_date and air_time in the season_air_dates view, so a time set by
-- hand moved nothing the listing had dated. And each read of the listing (add-show.ts listedSeason, the daily job) wrote
-- its premiere, finale, count and air time over what an admin set.
--
--   times_held_at   when Setup's When it airs (or classic's schedule fields) set the times by hand: the listing's per-episode
--                   rows stop counting in season_air_dates (research's exact starts still do: an episode research dates
--                   differently keeps its own), and a read of its listing leaves the premiere, finale, release, drop and air
--                   time. NULL: as before.
--   count_held_at   when the episode count was set by hand: a read of its listing leaves the count (and the finale date).
--
-- Linking a listing from Setup ("Use this listing") clears both: its times replace the ones set by hand.
--
-- The view keeps its columns; only the listing rows of a season whose times are held drop out.
ALTER TABLE show_seasons ADD COLUMN times_held_at TIMESTAMPTZ;
ALTER TABLE show_seasons ADD COLUMN count_held_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW season_air_dates AS
SELECT ss.id AS season_id,
       COALESCE((SELECT jsonb_object_agg(e->>'number', e->>'airDate')
                   FROM wiki_extractions we, jsonb_array_elements(we.payload->'episodes') e
                  WHERE we.show_id = ss.show_id AND we.season_number = ss.season_number AND we.kind = 'episodes'
                    AND e->>'airDate' IS NOT NULL), '{}'::jsonb)
       || COALESCE((SELECT jsonb_object_agg(se.number::text, to_char(se.air_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                      FROM season_episodes se
                     WHERE se.season_id = ss.id AND se.air_at IS NOT NULL
                       AND (ss.times_held_at IS NULL OR se.source <> 'listing')), '{}'::jsonb) AS air_dates,
       COALESCE((SELECT jsonb_object_agg(se.number::text, se.runtime_min)
                   FROM season_episodes se
                  WHERE se.season_id = ss.id AND se.runtime_min IS NOT NULL), '{}'::jsonb) AS runtimes
  FROM show_seasons ss;
