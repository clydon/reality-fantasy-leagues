-- Planned nights (docs/PLAN-new-design.md step 11 part 3; the mock's watching.js inviteWatch and streaming.js plans): someone on a
-- couch plans a watch along for an episode, the live airing or a shared start at a time they pick, and invites people on the
-- couch; each says I'm in or Can't make it, and whoever planned it can call it off. The guide tags the airing or shows the night as
-- a card of its own; the hub's feed has a line. Watch along itself (joining it, the shared clock) is step 13's. Additive, and
-- classic reads none of it.
--
-- A plan is one couch's, for one episode of one season: at most one going at a time per couch, season and episode (a second
-- would be the same night twice). `starts_at` is the shared start, or for the live airing the episode's air time when it was
-- planned (the reads follow the schedule if it moves). `cancelled_at` keeps a called-off night for Undo. Never a title or a
-- result: when, which episode, and who's in.
CREATE TABLE watch_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  how TEXT NOT NULL CHECK (how IN ('live', 'start')),
  starts_at TIMESTAMPTZ NOT NULL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX watch_plans_one ON watch_plans (couch_id, season_id, episode) WHERE cancelled_at IS NULL;
CREATE INDEX watch_plans_couch ON watch_plans (couch_id, starts_at);

-- Who's asked and what they said: whoever planned it ('in' from the start), everyone they invited ('invited' until they answer),
-- and anyone else on the couch who joined it (`invited` false). 'out' is Can't make it.
CREATE TABLE watch_plan_people (
  plan_id UUID NOT NULL REFERENCES watch_plans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  answer TEXT NOT NULL DEFAULT 'invited' CHECK (answer IN ('invited', 'in', 'out')),
  invited BOOLEAN NOT NULL DEFAULT true,
  answered_at TIMESTAMPTZ,
  PRIMARY KEY (plan_id, user_id)
);
CREATE INDEX watch_plan_people_user ON watch_plan_people (user_id);
