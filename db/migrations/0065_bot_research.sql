-- Bot research (experimental): the ask-AI bot (src/lib/server/ask-bot.ts, a ChatGPT session on our
-- own VM) asks about each episode on a schedule counted from its air time, free. A season's schedule
-- is a list of runs, each a kind and how long after airing:
--
--   quick -- who left the game, and the episode's headline, minutes after it airs
--   full  -- the whole research checklist, staged for review exactly like a pasted answer
--
-- e.g. [{"kind":"quick","after":5,"on":true},{"kind":"full","after":60,"on":true},{"kind":"full","after":540,"on":true}]
-- ("after" in minutes). Separate from auto_research (0020), which is the paid Claude schedule.
ALTER TABLE show_seasons
  ADD COLUMN bot_research_on BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN bot_research_schedule JSONB,
  -- When it was switched on: only runs whose time comes after this are picked up, so switching it on
  -- mid-season doesn't ask about every back episode at once.
  ADD COLUMN bot_research_since TIMESTAMPTZ;

-- Every run, one row per attempt. ok is NULL while it runs. A quick run keeps its answer in result;
-- a full run's answers live in episode_research like any other, and result keeps the counts.
CREATE TABLE bot_research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  -- Which schedule entry this run is for, "kind@minutes" ("quick@5"); "now" for one an admin asked for.
  slot TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('quick', 'full')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  ok BOOLEAN,
  message TEXT,
  result JSONB,
  seconds REAL
);
CREATE INDEX idx_bot_research_runs ON bot_research_runs(season_id, episode_number, started_at DESC);
