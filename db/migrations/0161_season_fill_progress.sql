-- Getting it ready, after the user tried it (docs/PLAN-getting-it-ready.md, 2026-11-01): how long the step it's on has been going
-- (the call sheet's estimate, from typical times), one notification when everything's in instead of one an episode, and the job's
-- own episode asks kept quiet. Additive.
--
--   season_fills.step_at   when the step it's on began
--   season_fills.told_at   when whoever added it was told it's all in
--   research_asks.quiet    an ask Getting it ready made: no notification an episode (season_fills.told_at's one says it all)
ALTER TABLE season_fills ADD COLUMN step_at TIMESTAMPTZ;
ALTER TABLE season_fills ADD COLUMN told_at TIMESTAMPTZ;
ALTER TABLE research_asks ADD COLUMN quiet BOOLEAN NOT NULL DEFAULT false;
