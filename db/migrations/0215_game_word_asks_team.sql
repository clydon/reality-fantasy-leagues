-- G3 part 2: the Start-a-game GPT's asks on a team's page (docs/PLAN-start-a-game-gpt.md step G3; src/lib/server/team-words.ts).
-- Someone types a game on a team's page before there's a season ("the 76ers home opener"): the ask is the team's (league, team)
-- until our check has picked its games and the matchup's season is made, then that season's too (season_id set on the same row).
-- A pick of games from our check's question (the wizard's "which games?" answered with one of its options) needs no bot: its row
-- changes the ask it answers (change_of) with what was picked (picked) and no typed change, and isn't counted against the day's
-- asks (game-words.ts asksToday).
--
--   league   the team's league, as ESPN names it ("basketball/nba"), on a team's page; null on a season's
--   team     the team's id in it (ESPN's), on a team's page
--   picked   the matchup ask picked from our check's options (src/lib/sports/matchup.ts MatchupAsk), on a pick's row
--
-- Additive: two columns and a looser check. A season's asks (0214) stay as they were: a season, no team, no pick. The check on a
-- change keeps 0214's rule (a change names the ask it changes, and a first ask doesn't) with a pick as a change of its own.
ALTER TABLE game_word_asks ALTER COLUMN season_id DROP NOT NULL;
ALTER TABLE game_word_asks ADD COLUMN league TEXT CHECK (league IS NULL OR char_length(league) BETWEEN 1 AND 80);
ALTER TABLE game_word_asks ADD COLUMN team TEXT CHECK (team IS NULL OR char_length(team) BETWEEN 1 AND 80);
ALTER TABLE game_word_asks ADD COLUMN picked JSONB;
ALTER TABLE game_word_asks ADD CONSTRAINT game_word_asks_page_check CHECK (season_id IS NOT NULL OR (league IS NOT NULL AND team IS NOT NULL));
ALTER TABLE game_word_asks DROP CONSTRAINT game_word_asks_check;
ALTER TABLE game_word_asks ADD CONSTRAINT game_word_asks_check CHECK ((change_of IS NULL) = (change IS NULL AND picked IS NULL));
