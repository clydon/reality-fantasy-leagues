-- A show's Art and photos on the desk (docs/PLAN-desk-parity.md part 7b, Noticed x): two frames, each with where it's from
-- and its framing. The Header is shows.backdrop_url (its page and Up next); the Cards are each season's poster, else the
-- show's (shows.art_url: Your shows, the guide). Until now shows.art_by_hand held all of it, so a link pasted for the poster
-- also stopped the finder ever bringing a backdrop; now each frame is held on its own:
--   backdrop_by_hand  the header was chosen from TMDB or linked: the finder leaves backdrop_url alone (art_by_hand is the
--                     poster's alone now)
--   art_link          the cards are a link (shows.art_url, by hand): it shows on every season's cards, over their own posters
--   backdrop_style    the header's framing, as shows.art_style is the cards': { x, y, zoom, url }, the window's centre in %
--                     of the image, its zoom, and the image it was framed on (a new image starts unframed)
-- Three additive columns, and the backfill below on an existing table: rehearsed with the step's merge.
ALTER TABLE shows ADD COLUMN IF NOT EXISTS backdrop_by_hand BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS art_link BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS backdrop_style JSONB;

-- A show chosen by hand keeps the backdrop it has (art_by_hand held it until now). One with none gets the finder's.
UPDATE shows SET backdrop_by_hand = true WHERE art_by_hand AND backdrop_url IS NOT NULL AND NOT backdrop_by_hand;
