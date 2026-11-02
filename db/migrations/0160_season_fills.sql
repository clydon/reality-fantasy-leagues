-- Getting it ready (docs/PLAN-getting-it-ready.md, src/lib/server/season-fill.ts): when someone adds a show, its season is got
-- ready by itself, in order: how it's played (its rulebook; a brand-new show's drafted by our bot and applied when our check
-- passes), who's in it (its cast), then what happened in each aired episode (recaps, and results where they're ours to look up).
-- What's done is read from the data itself; this row is the job: who started it, the step it's on, the ask going now (asking_at,
-- stale after a few minutes), tries at this step, and why it stopped when it did. Additive.
--
--   season_fills   one per season: `episodes` false when whoever added it switched the episodes off; done_at once everything's
--                  in; stuck_at when a step failed its last try (Try again clears it).
CREATE TABLE season_fills (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  started_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  episodes BOOLEAN NOT NULL DEFAULT true,
  step TEXT CHECK (step IN ('rules', 'cast', 'episodes')),
  tries INTEGER NOT NULL DEFAULT 0,
  asking_at TIMESTAMPTZ,
  tried_at TIMESTAMPTZ,
  message TEXT,
  stuck_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The bot's clock looks for jobs still to run.
CREATE INDEX season_fills_open ON season_fills (tried_at) WHERE done_at IS NULL AND stuck_at IS NULL;
