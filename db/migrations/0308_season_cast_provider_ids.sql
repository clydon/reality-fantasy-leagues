-- A sport's people are unique by the provider's id, not by name (docs/PLAN-sports-ready.md step 1.3, BACKLOG 145). A season's
-- cast was unique by lower(name) (0011), so on a league-wide slate the second of two players who share a name was left out:
-- whichever team played first kept the name (the NFL has two Josh Allens; the 2026 season, six such pairs, Justin Jefferson's
-- among them). Additive in effect:
--
--   season_cast_name_idx       still unique by lower(name) for everyone with no provider ids: a show's cast, and a sport's filled
--                              by our bot or a paste. Every insert that relied on it names no conflict target or this one's
--                              predicate (ON CONFLICT (season_id, lower(name)) WHERE provider_ids IS NULL).
--   season_cast_provider_idx   unique by provider ids for a sport's people from the provider (sports/cast.ts): two who share a
--                              name are two rows, each with its own ids. The app links a game's people to these rows by id
--                              (castaway.seasonCastId), never by name.
--
-- No row changes: the old index already held every existing row to one name each, and no two rows share provider ids (the fill
-- looked them up by id before adding).
DROP INDEX season_cast_name_idx;
CREATE UNIQUE INDEX season_cast_name_idx ON season_cast (season_id, lower(name)) WHERE provider_ids IS NULL;
CREATE UNIQUE INDEX season_cast_provider_idx ON season_cast (season_id, provider_ids) WHERE provider_ids IS NOT NULL;
