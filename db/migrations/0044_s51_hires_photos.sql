-- Survivor 51's imported cast photos, swapped from the wiki's 90x90 icons to the app's own copies.
--
-- The connector takes each castaway's photo from the wiki's cast table, and on the Survivor wiki that
-- table uses the small icon files -- S51_aaliyah_t.png and friends, 90x90 -- which look soft at 64px
-- and plainly blurry in the tap-to-zoom view. The wiki does have full-size portraits
-- (S51_Aaliyah_Puglia.jpg, 1536 wide), but Fandom refuses any full-size file to a request carrying
-- another site's Referer, and the one form it does serve cross-site -- the canonical path with no
-- /revision/ suffix (see 0012) -- comes back downscaled to ~200px. So there's no wiki URL to point at.
--
-- Instead the portraits were cropped to head-and-shoulders (480x600) and committed to
-- public/photos/s51/, replacing the 300x364 copies already there under the same names. This points
-- every stored wiki icon URL for the season at those files. Matched on the icon filename alone, so a
-- photo someone set by hand is left alone; the one name whose file key differs is Thien An's.
--
-- Same three places as 0012, and each statement is a no-op on rows that don't match.

CREATE FUNCTION pg_temp.s51_photo(url TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN url ~ '^https://static\.wikia\.nocookie\.net/survivor/images/.+/S51_[a-z]+_t\.png$'
      THEN 'photos/s51/' ||
           replace(substring(url FROM '/S51_([a-z]+)_t\.png$'), 'thienan', 'thien_an') || '.jpg'
    ELSE url
  END
$$;

-- 1. The admin-reviewed season cast.
UPDATE season_cast
   SET photo_url = pg_temp.s51_photo(photo_url)
 WHERE photo_url LIKE '%/S51\_%\_t.png';

-- 2. Castaways already applied into a league's own state (order kept, as in 0012).
UPDATE leagues l
   SET state = jsonb_set(
         l.state,
         '{castaways}',
         (SELECT COALESCE(jsonb_agg(
                   CASE WHEN c->>'photoUrl' LIKE '%/S51\_%\_t.png'
                        THEN jsonb_set(c, '{photoUrl}', to_jsonb(pg_temp.s51_photo(c->>'photoUrl')))
                        ELSE c END
                   ORDER BY ord), '[]'::jsonb)
            FROM jsonb_array_elements(l.state->'castaways') WITH ORDINALITY AS t(c, ord))
       )
 WHERE jsonb_typeof(l.state->'castaways') = 'array'
   AND l.state->>'castaways' LIKE '%/S51\_%\_t.png%';

-- 3. The cached extraction's photo map, so a re-stage of the unchanged wiki page doesn't hand the
--    icons back.
UPDATE wiki_extractions
   SET payload = jsonb_set(
         payload,
         '{photos}',
         (SELECT COALESCE(jsonb_object_agg(k, to_jsonb(pg_temp.s51_photo(v #>> '{}'))), '{}'::jsonb)
            FROM jsonb_each(payload->'photos') AS e(k, v))
       )
 WHERE kind = 'cast'
   AND jsonb_typeof(payload->'photos') = 'object'
   AND payload->>'photos' LIKE '%/S51\_%\_t.png%';
