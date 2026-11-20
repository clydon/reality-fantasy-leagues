-- Live previews' allowance by the week, sized from the month's budget (docs/PLAN-preview-release.md, decision 4, revised 2026-11-20):
-- each person's share is worked out once, at the first look of their week (Monday, their own time zone), and kept for that week, so
-- their count doesn't jump about while they're mid-way through setting up a game. The uses themselves stay in preview_uses.
CREATE TABLE preview_week_shares (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- The Monday that starts the week, in the person's own time zone.
  week_start DATE NOT NULL,
  allowance INT NOT NULL CHECK (allowance >= 0),
  -- What it came from, for the desk and for checking it: previews left in the month, people previewing, weeks left.
  basis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);
