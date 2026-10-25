-- How results get in (docs/PLAN-new-design.md step 6c). Per couch and season, three ways: copy and paste (free,
-- always), One tap ("Ask ChatGPT for me": our bot asks and sends the answer; one person unlocks it for the whole couch)
-- and Autopilot (the bot's schedule; coming soon). Who went home is always free. Prices show with "Free during beta" and
-- nothing is charged. Additive.
--
-- 1. What a couch has unlocked for a season. One row per way; `charged_cents` is what was paid (0 during beta), so a
--    couch that unlocked in beta can be told apart later.
CREATE TABLE results_plans (
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('tap', 'autopilot')),
  unlocked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  charged_cents INT NOT NULL DEFAULT 0,
  PRIMARY KEY (couch_id, season_id, plan)
);

-- 2. One tap runs on the bot like a scheduled run (bot_research_runs, slot 'tap'), with who asked and for which couch:
--    whoever opens the sheet while it runs sees it running, and a second tap joins it rather than asking twice.
ALTER TABLE bot_research_runs
  ADD COLUMN couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  ADD COLUMN asked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- 3. A quick check that waits (step 5 kept it only on the open page): an answer about who went home that couldn't be
--    trusted on its own (one source, a name not in the cast, no way out given). It waits in Backstage until someone who
--    runs a game says It's right or Not right, or results arrive another way. A couch's own (pasted or One tap) shows
--    on that couch; the bot's own scheduled check (couch_id NULL) shows on every couch with a game on the season. The
--    answer keeps the names; Backstage shows them only behind Show me.
CREATE TABLE quick_waits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INT NOT NULL CHECK (episode_number >= 1),
  couch_id UUID REFERENCES couches(id) ON DELETE CASCADE,
  sent_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  via TEXT NOT NULL CHECK (via IN ('paste', 'tap', 'autopilot')),
  answer JSONB NOT NULL,
  doubt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  outcome TEXT CHECK (outcome IN ('right', 'not-right', 'replaced'))
);
CREATE INDEX idx_quick_waits_open ON quick_waits (season_id, episode_number, created_at DESC) WHERE closed_at IS NULL;
