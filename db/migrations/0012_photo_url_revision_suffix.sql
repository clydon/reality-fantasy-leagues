-- Cut Fandom's revision suffix off every photo URL already stored.
--
-- MediaWiki's imageinfo API returns file URLs in a revision form:
--
--   https://static.wikia.nocookie.net/survivor/images/5/57/S51_aaliyah_t.png/revision/latest?cb=20260904163427
--
-- which does not load from another site -- an <img> pointing at it fails, so every imported castaway
-- fell back to initials. The canonical path above it (the same URL up to the extension) always
-- loads. db/wiki-sync.js's normalizePhotoUrl now cuts it at import; this fixes the rows written
-- before that, in the three places such a URL can already be sitting.
--
-- split_part(x, '/revision/', 1) is the same rule: everything before the suffix, and a URL without
-- one comes back unchanged -- so each statement is safe to run over rows that don't need it, and
-- every WHERE below is an optimisation rather than a correctness guard.

-- 1. The admin-reviewed season cast (db/migrations/0011).
UPDATE season_cast
   SET photo_url = split_part(photo_url, '/revision/', 1)
 WHERE photo_url LIKE '%/revision/%';

-- 2. Castaways already applied into a league's own state. A JSONB array, so it's rebuilt element by
--    element; WITH ORDINALITY + ORDER BY keeps the cast in the order it was approved in, which is
--    the spoiler-free ordering the connector staged (see stageSeasonCast).
UPDATE leagues l
   SET state = jsonb_set(
         l.state,
         '{castaways}',
         (SELECT COALESCE(jsonb_agg(
                   CASE WHEN c->>'photoUrl' LIKE '%/revision/%'
                        THEN jsonb_set(c, '{photoUrl}', to_jsonb(split_part(c->>'photoUrl', '/revision/', 1)))
                        ELSE c END
                   ORDER BY ord), '[]'::jsonb)
            FROM jsonb_array_elements(l.state->'castaways') WITH ORDINALITY AS t(c, ord))
       )
 WHERE jsonb_typeof(l.state->'castaways') = 'array'
   AND l.state->>'castaways' LIKE '%/revision/%';

-- 3. The cached extraction's own photo map. Keyed on wiki revision ids, so a season whose page
--    hasn't changed would otherwise keep handing the old URLs back to the next staging run without
--    ever re-reading the wiki.
UPDATE wiki_extractions
   SET payload = jsonb_set(
         payload,
         '{photos}',
         (SELECT COALESCE(jsonb_object_agg(k, to_jsonb(split_part(v #>> '{}', '/revision/', 1))), '{}'::jsonb)
            FROM jsonb_each(payload->'photos') AS e(k, v))
       )
 WHERE kind = 'cast'
   AND jsonb_typeof(payload->'photos') = 'object'
   AND payload->>'photos' LIKE '%/revision/%';
