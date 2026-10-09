-- Who decides a season's episode results (docs/PLAN-universal-season-cast.md, piece 4), separate from
-- whether it has an approved cast. Until now the two were one thing: approving a cast is what opened
-- an admin's Episodes step, and an admin's Accept pushed results into every league on the season. So
-- "this season has one master cast" and "the admin decides this season's results" couldn't be had
-- separately, and a self-serve season could have neither.
--
--   admin    an admin's Accept pushes results into every league (syncSeasonLeagues /
--            syncLeagueDecisions), exactly as before. How the Survivor 51 leagues work.
--   leagues  each league's commissioner applies results to their own league (the episode research
--            panel); the season sync never touches a league. An admin's Episodes step only curates.
--
-- results_admin_since is the cutoff for a season switched from leagues to admin: only decisions
-- settled at or after it are pushed, and nothing settled before it is ever pushed or undone -- each
-- league's results up to the switch are its commissioner's (the plan's open question 3). NULL means no
-- cutoff, i.e. every decision, which is what every admin season had before this column existed.
ALTER TABLE show_seasons
  ADD COLUMN results_by TEXT NOT NULL DEFAULT 'leagues' CHECK (results_by IN ('admin', 'leagues')),
  ADD COLUMN results_admin_since TIMESTAMPTZ;

-- Existing catalogued seasons keep working exactly as they do: an approved cast is what made an
-- admin's Accept reach leagues before, so those seasons are admin-decided, with no cutoff. Everything
-- else (lazily created by episode research, self-serve) takes the default.
UPDATE show_seasons SET results_by = 'admin' WHERE cast_approved_at IS NOT NULL;
