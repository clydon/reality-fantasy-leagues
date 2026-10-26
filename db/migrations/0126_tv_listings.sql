-- All of TV in the guide (docs/PLAN-new-design.md step 11 part 2): the guide's "Also on", what else is on each evening
-- under your shows and the couch's. Eight days of TVmaze's US schedule (/schedule?country=US) and streaming (/schedule/web,
-- in English, on a US or worldwide service), less the news, refreshed once a day by the listings job
-- (src/lib/server/tv-listings.ts), which rides on the bot clock's calls (docs/HOSTING.md). Additive, and classic reads none
-- of it. It's TV data, fetched again every day, so the backups leave it out (scripts/backup-common.js).
--
-- A row is one airing: an episode on a network in the evening (5 PM to 3 AM where it airs), or a streaming episode with no
-- air time (a drop: TVmaze gives those the day's date and no time). A show on a network and its streaming service at once is
-- one row (the episode's id). `day` is the schedule's date it was listed under (TVmaze's, Eastern for the networks): the job
-- replaces a day's rows each time it reads that day, and drops days that have gone by. The show's name, network, type, art
-- and popularity (`weight`, TVmaze's 0-100) ride on each row, so the guide's read is one table. Never an episode's title:
-- the guide shows when things air, never what happens in them.
CREATE TABLE tv_listings (
  episode_id INTEGER PRIMARY KEY,
  day DATE NOT NULL,
  tvmaze_id INTEGER NOT NULL,
  air_at TIMESTAMPTZ NOT NULL,
  runtime_min SMALLINT,
  season INTEGER,
  number INTEGER,
  binge BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  type TEXT,
  network TEXT,
  country TEXT,
  weight SMALLINT NOT NULL DEFAULT 0,
  art_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tv_listings_day ON tv_listings (day);
CREATE INDEX tv_listings_show ON tv_listings (tvmaze_id);
