-- A season's status set by hand holds (docs/PLAN-desk-parity.md step 3, part 3a; Noticed a). A season linked to its TV
-- listing (listing_id) moves on by the listing's dates: the daily listings job (tv-listings.ts statusesByDate) and a read
-- of its listing (add-show.ts listedSeason) set its status each time, so a status an admin chose was undone by morning.
--
--   status_held_at   when a status set on the desk started holding over the listing's dates (NULL: the listing's dates
--                    move it, as before). Setup's "Back to its listing's dates" clears it.
--
-- Additive: one nullable column, nothing read changes until something sets it.
ALTER TABLE show_seasons ADD COLUMN status_held_at TIMESTAMPTZ;
