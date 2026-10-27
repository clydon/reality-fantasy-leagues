-- Show and season art and cast photos, found on their own (docs/RESEARCH-show-art-and-cast-photos.md;
-- src/lib/server/show-art.ts). Additive: every reader keeps working with these empty.
--
-- Images stay plain URLs in the columns that already hold them (shows.art_url, season_cast.photo_url, a league
-- castaway's photoUrl). TMDB's are on image.tmdb.org, so "remove everything from TMDB" (its free key ends if the app
-- charges) is one UPDATE ... WHERE url LIKE 'https://image.tmdb.org/%'.
--
--   shows.tmdb_id          the show on TMDB (found from TVmaze's IMDb / TheTVDB ids, else by name)
--   shows.backdrop_url     a landscape image for the header (TMDB backdrop, textless first)
--   shows.logo_url         the show's logo (transparent PNG); stored, not drawn yet (a look to mock first)
--   shows.art_by_hand      an admin chose the art (Choose art, or a pasted URL): the finder never changes it
--   shows.art_off          the per-show switch: no art and no cast photos drawn (initials), e.g. after a removal request
--   shows.art_checked_at   when the finder last asked TMDB (TMDB's data may be kept six months; the daily job re-asks)
--   show_seasons.art_url        the season's own poster (cards); the show's when null
--   show_seasons.art_by_hand    an admin chose it
--   show_seasons.tmdb_season    TMDB's season number when it isn't ours (null: the same number)
--   show_seasons.photos_checked_at  when the finder last looked for this season's cast photos
--
-- Nothing here is backed up separately: the finder can find it all again.
ALTER TABLE shows
  ADD COLUMN tmdb_id INTEGER,
  ADD COLUMN backdrop_url TEXT,
  ADD COLUMN logo_url TEXT,
  ADD COLUMN art_by_hand BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN art_off BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN art_checked_at TIMESTAMPTZ;

ALTER TABLE show_seasons
  ADD COLUMN art_url TEXT,
  ADD COLUMN art_by_hand BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tmdb_season INTEGER,
  ADD COLUMN photos_checked_at TIMESTAMPTZ;

-- Art an admin already set (anything but the TVmaze poster Add a show fills in) counts as chosen by hand.
UPDATE shows SET art_by_hand = true
 WHERE COALESCE(art_url, '') <> '' AND art_url NOT LIKE 'https://static.tvmaze.com/%';
