-- A playoff's series as a bracket (docs/PLAN-start-a-game-gpt.md track L, L8 part 1's engine items, part 2;
-- src/lib/sports/playoffs.ts). Additive:
--
--   season_events   a linked game's note as the provider lists it ("East 1st Round - Game 3", "ALDS - Game 2", "AFC Wild Card
--                   Playoffs") and how many games its series is at most (ESPN's series.totalCompetitions: 7, 5, 3; NULL for a
--                   game that isn't one of a series, the NFL's), so a league's playoffs slate reads each series and its round from
--                   its own links. Written as a slate links a game and refreshed at each sync; NULL for every link before this
--                   (a regular season's, a team's season's, a matchup's: nothing reads them there).
ALTER TABLE season_events ADD COLUMN note TEXT CHECK (length(note) <= 200);
ALTER TABLE season_events ADD COLUMN best_of SMALLINT CHECK (best_of BETWEEN 1 AND 15);
