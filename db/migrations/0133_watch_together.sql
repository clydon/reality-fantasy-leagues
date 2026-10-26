-- Watching together (docs/PLAN-new-design.md step 13 part 3; the mock's watching.js: "Watching together", Pause for everyone,
-- "riley paused for everyone · Resume for everyone", "3, 2, 1 for everyone in it"). Additive, and classic reads none of it.
--
-- A together session is a planned night's (watch_plans, 0127) watch along: one clock for everyone in it, on the plan's couch.
-- Opening the night's watch along joins it (and leaves your own session of that episode there); anyone in it starts it ("3, 2, 1":
-- `running_since` a few seconds ahead, so every phone starts at the same moment), pauses it, moves it or starts an ad break, for
-- all of them, each write bumping `version`, which the open watch alongs poll. `changed_by`, `change` and `changed_at` say who
-- last did what ("riley paused for everyone"). People come and go through watch_session_people as in part 2; when the last one
-- leaves, the clock stops where it is. A session is still a clock and a heartbeat: not backed up (the plan's As built says why).
ALTER TABLE watch_sessions ADD COLUMN plan_id UUID REFERENCES watch_plans(id) ON DELETE CASCADE;
ALTER TABLE watch_sessions ADD COLUMN changed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE watch_sessions ADD COLUMN change TEXT CHECK (change IN ('start', 'pause', 'resume', 'ad', 'show', 'move'));
ALTER TABLE watch_sessions ADD COLUMN changed_at TIMESTAMPTZ;
-- A together session is a plan's, on its couch; your own (part 2's) never has a plan.
ALTER TABLE watch_sessions ADD CONSTRAINT watch_sessions_together_plan CHECK (together = (plan_id IS NOT NULL) AND (NOT together OR couch_id IS NOT NULL));
-- One together session a planned night.
CREATE UNIQUE INDEX watch_sessions_plan ON watch_sessions (plan_id) WHERE together;
