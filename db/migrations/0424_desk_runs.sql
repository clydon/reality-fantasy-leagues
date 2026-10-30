-- Run now on the desk (docs/PLAN-desk-parity.md step 4, part 4a): a run an admin asks for is queued, not run inside the
-- request. Classic's Run now asks the bot inside its request (up to 300 s) with no progress; the bot answers one question at
-- a time, so a second ask while one runs waited inside the bot and used up its own request's time. Here the request queues
-- the run and answers at once; whichever request is driving the queue (src/lib/server/desk-research.ts drainDeskRuns) waits
-- for the run in progress to end, then asks, and hands the next queued run to a request of its own. The run itself is a
-- bot_research_runs row like any (slot 'now'), linked here once it ends.
--
--   desk_runs   one per Run now: the season, the episode (bingo's season bank: the episode it was asked from), the kind,
--               who asked and when; `bot` a dev server's stand-in bot (the x-gys-bot header, next dev only; never read in
--               production); `driven_at` when a request last took charge of it (another takes over once it's 6 minutes
--               old: a redeploy cut the last one off); started, ended, how it went, and its run.
--
-- Additive: a new table.
CREATE TABLE desk_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('quick', 'full', 'schedule', 'trivia', 'bingo')),
  for_season BOOLEAN NOT NULL DEFAULT false,
  asked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bot TEXT,
  driven_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  run_id UUID REFERENCES bot_research_runs(id) ON DELETE SET NULL,
  done_at TIMESTAMPTZ,
  ok BOOLEAN,
  message TEXT
);
CREATE INDEX desk_runs_open ON desk_runs (asked_at) WHERE done_at IS NULL;
-- One open run per season, kind and episode: a second ask for the same joins the first.
CREATE UNIQUE INDEX desk_runs_one ON desk_runs (season_id, kind, episode_number, for_season) WHERE done_at IS NULL;
CREATE INDEX desk_runs_season ON desk_runs (season_id, asked_at DESC);
