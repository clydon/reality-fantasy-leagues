-- Watching (docs/PLAN-new-design.md step 10 part 1): Add a show, from TV listings or by name, and the hub's "you both
-- watch" nudge. Additive: classic reads none of these.
--
-- set_up_at: when a show became a game (its rulebook and cast are set up). NULL = "Not a game yet": a show someone added
--   to follow (from its TV listing, or by name), which Make it a game (step 10 part 2) sets up. Every show made before
--   this (an admin's, or classic's self-serve research) is set up; so is any made later through the old routes, hence the
--   default.
-- tvmaze_id / listing: the show's TVmaze entry (src/lib/server/listings.ts) when it came from, or was matched to, the
--   listings: one show per TVmaze id. listing holds what the listing said that the app reads (its type, network, country,
--   premiere year, link back) and when it was fetched; TVmaze's data is CC BY-SA, credited where it's shown.
ALTER TABLE shows ADD COLUMN set_up_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE shows ADD COLUMN tvmaze_id INTEGER;
ALTER TABLE shows ADD COLUMN listing JSONB;
CREATE UNIQUE INDEX shows_tvmaze_id ON shows(tvmaze_id) WHERE tvmaze_id IS NOT NULL;

-- A season made from its listing: TVmaze's season id, and when its episodes were last read from it (adding the show again
-- a day later reads them again; step 11's daily job keeps them current after that).
ALTER TABLE show_seasons ADD COLUMN listing_id INTEGER;
ALTER TABLE show_seasons ADD COLUMN listing_fetched_at TIMESTAMPTZ;

-- An episode's air time from the listings. Research still writes over it (its upsert skips only 'admin' rows), and a
-- listing read never writes over research (it only touches its own rows research hasn't reported on).
ALTER TABLE season_episodes DROP CONSTRAINT season_episodes_source_check;
ALTER TABLE season_episodes ADD CONSTRAINT season_episodes_source_check CHECK (source IN ('research', 'admin', 'listing'));

-- The hub's "You and jordan both watch The Amazing Race" (once per show): Not now, or a game started from it.
ALTER TABLE show_follows ADD COLUMN nudge_off_at TIMESTAMPTZ;
