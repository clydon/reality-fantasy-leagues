-- No league logos kept or drawn (docs/PLAN-team-logos.md L0, the user's call 2026-11-22): the app shows its own badge for a team
-- (its abbreviation on its colour, src/lib/sports/team-badge.ts), never a league's or ESPN's logo. The code stopped reading them;
-- this clears what was kept before. Safe to run again: each statement only touches rows that still hold one.
--
-- Followed teams: the column stays (always NULL from now on).
UPDATE team_follows SET logo = NULL WHERE logo IS NOT NULL;

-- The sports cache keeps the provider's answers already read into our shapes, `logo` among them: blank it in place rather than
-- drop the rows (a final box score is kept for good), so everything else stays exactly as it was.
UPDATE sports_cache
   SET value = regexp_replace(value::text, '"logo": "[^"]*"', '"logo": null', 'g')::jsonb
 WHERE value::text LIKE '%"logo": "%';

-- A team defense's picture was its ESPN logo: on the season's people (season_cast.photo_url) and the copies in each game's state
-- (a castaway's photoUrl). Cleared here, so they show initials; the daily roster refresh (cast.ts saveCast) then gives each one the
-- badge and brings every game on the season in line (a season with nothing near now keeps the initials).
UPDATE season_cast SET photo_url = NULL WHERE photo_url ~* 'espncdn\.com/[^ ]*teamlogos/';

UPDATE leagues
   SET state = regexp_replace(state::text, '"photoUrl": "[^"]*espncdn\.com/[^"]*teamlogos/[^"]*"', '"photoUrl": null', 'gi')::jsonb
 WHERE state::text ~* 'espncdn\.com/[^"]*teamlogos/';
