-- A count rides on its result (docs/PLAN-new-design.md step R2): a compiled rulebook's "each time" and "per
-- amount" moments score once per unit (formats/rules.js `per`: 3 home runs, 6.67 innings pitched), but staging
-- keeps one row per person, episode and event (idx_season_decisions_identity), so the count travels on that
-- row, the way a finalist's jury votes do (0036), and onto the league's recorded event
-- (episode.scoringEvents[].units) when applied. NULL means one, which is every result before this.
ALTER TABLE season_decisions ADD COLUMN units NUMERIC CHECK (units > 0);
