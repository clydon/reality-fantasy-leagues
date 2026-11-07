-- A team's season as one matchup (docs/PLAN-start-a-game-gpt.md track L, L7: finding a game by team; src/lib/server/sports/find.ts).
-- A matchup was 1 to 30 games (a game, a series, a team's next few, their meetings); a team's regular season is up to 162 games
-- (an MLB team's, its postponed games' makeups listed as games of their own), so a matchup takes up to 200. A team's season is
-- keyed by the team and its season ("espn:baseball/mlb:season:10:2026", src/lib/sports/matchup.ts seasonKey), never by its
-- games, so its key stays short. Additive: every matchup made so far is 30 games or fewer.
ALTER TABLE sports_matchups DROP CONSTRAINT IF EXISTS sports_matchups_events_check;
ALTER TABLE sports_matchups ADD CONSTRAINT sports_matchups_events_check CHECK (cardinality(events) BETWEEN 1 AND 200);
