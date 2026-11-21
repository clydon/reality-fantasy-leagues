-- A game through the playoffs (docs/PLAN-sports-ready.md step 2.7; the user, 2026-11-20: a game's timing is the maker's, the regular
-- season by default or on through the playoffs to the final). Additive:
--
--   sports_slates.stage      'full' as well: one season of a league's regular season and then its playoffs, so a game's timing is its
--                            span on that one season and Game settings can move it across the line. A new league's slate is full
--                            whenever its calendar lists both stages (src/lib/server/sports/slate.ts usualStage); 'regular' and
--                            'post' slates stay as they were made.
--   sports_slates.regular_through     a full slate's last regular-season episode (its regular season's episodes come first); null
--                            for a slate of one stage.
--   sports_matchups.regular_through   a team's season that takes its playoff games as they're set (the daily listings job: team-season.ts
--                            growTeamSeasons): its regular season's last episode, its playoff games after it. Null for a matchup of
--                            games picked one by one, which never grows. Every team's season made before this is one of its
--                            regular season's games (find.ts regularOf), so it's set to its games' count: each grows from now on.
--   sports_matchups.ended_at          when a team's season that grows was over: its team out of the playoffs, or the champion. Until
--                            then its season isn't completed, whatever its games' states (a top seed's bye week).
ALTER TABLE sports_slates DROP CONSTRAINT IF EXISTS sports_slates_stage_check;
ALTER TABLE sports_slates ADD CONSTRAINT sports_slates_stage_check CHECK (stage IN ('regular', 'post', 'full'));
ALTER TABLE sports_slates ADD COLUMN IF NOT EXISTS regular_through INTEGER CHECK (regular_through IS NULL OR regular_through >= 1);

ALTER TABLE sports_matchups ADD COLUMN IF NOT EXISTS regular_through INTEGER CHECK (regular_through IS NULL OR regular_through >= 1);
ALTER TABLE sports_matchups ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
UPDATE sports_matchups SET regular_through = cardinality(events) WHERE key LIKE '%:season:%' AND regular_through IS NULL;
