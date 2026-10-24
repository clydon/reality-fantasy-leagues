-- Fills in show_follows (0102) from the leagues people play: everyone in a league on a catalogued season
-- follows that season, seen through the furthest any of their leagues has them (results_seen_through). No
-- mark yet (they haven't opened the league since spoiler protection began, or they see results straight
-- away) counts as 0: the guard fails closed, and their next classic visit moves it on (follows.ts).
--
-- Safe to run again: it only ever moves a follow forward. tests/couch-backfill.test.js runs it inside a
-- rolled-back transaction, and scripts/restore-leagues.js runs it after restoring a backup taken before 0102.
INSERT INTO show_follows (user_id, season_id, seen_through)
SELECT m.user_id, ss.id, max(COALESCE(m.results_seen_through, 0))
  FROM league_memberships m
  JOIN leagues l ON l.id = m.league_id
  JOIN shows s ON s.slug = l.state->'settings'->>'showId'
  JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
 GROUP BY m.user_id, ss.id
ON CONFLICT (user_id, season_id) DO UPDATE
   SET seen_through = EXCLUDED.seen_through, updated_at = now()
 WHERE EXCLUDED.seen_through > show_follows.seen_through;
