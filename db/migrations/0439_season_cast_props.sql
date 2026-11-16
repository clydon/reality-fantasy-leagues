-- Cast properties and bios (docs/PLAN-cast-properties.md, chunk 2): what the show itself sorts each person by and how it bills
-- them, researched with the cast and reviewed on the desk.
--   props: the season's starting values of the rulebook's cast.properties, by key ({ "department": "Interior", "job": "Chief
--          stew" }); a property left out is "not stated". A sport's position stays in `role`.
--   bio:   who they are, as the show bills them ({ hometown, residence, age, occupation, line, source }); null when not looked
--          up. Display only: no game rule reads it.
-- Both are read per request (stamped into game reads, never copied into a league's state), so one set of values serves every
-- game on the season. Their changes are logged in season_cast_changes as before (field 'props' and 'bio', JSON text).
ALTER TABLE season_cast ADD COLUMN IF NOT EXISTS props jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE season_cast ADD COLUMN IF NOT EXISTS bio jsonb;
ALTER TABLE season_cast DROP CONSTRAINT IF EXISTS season_cast_props_shape;
ALTER TABLE season_cast ADD CONSTRAINT season_cast_props_shape CHECK (jsonb_typeof(props) = 'object' AND length(props::text) <= 2000);
ALTER TABLE season_cast DROP CONSTRAINT IF EXISTS season_cast_bio_shape;
ALTER TABLE season_cast ADD CONSTRAINT season_cast_bio_shape CHECK (bio IS NULL OR (jsonb_typeof(bio) = 'object' AND length(bio::text) <= 2000));
