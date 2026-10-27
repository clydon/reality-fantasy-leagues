-- The guide's Competitions (2026-10-27): its switch shows the couch's shows only, the couch's plus the competitions on TV, or
-- all of TV. A listing is a competition when its show is a reality or game show whose TVmaze blurb says what a competition
-- does (src/lib/game/tv-listings.ts competitionOf), worked out by the daily listings job as it writes each row; a show set up
-- here goes by its own kind instead, on read (src/lib/server/tv-listings.ts listingsWeek). Additive. Rows already here say
-- false until the job's next run rewrites them (it rewrites all eight days once a day). TV data, not backed up.
ALTER TABLE tv_listings ADD COLUMN competition BOOLEAN NOT NULL DEFAULT false;
