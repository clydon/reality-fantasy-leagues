-- Stored show formats (docs/PLAN-stage-3-format-proposals.md): formats nobody hand-wrote, researched
-- by a web-searching chat, reviewed and approved by an admin. The built-in formats stay code
-- (src/lib/game/formats/); this table holds the others, and shows.format names either kind by id, so
-- there's no foreign key (the built-ins aren't rows). The code refuses a built-in id here.
--
-- `proposal` is what the admin edits on the review screen -- the chat's answer, row by row, including
-- what's for review only (tiers, untrackable facts, flagged mechanics). `data` is the format's data
-- half, derived from it and validated (formatProblems) on approval; leagues on a show using the format
-- cache a copy in settings.showFormatData so the game logic never needs the database.
--
-- Purely additive: no existing row is read or changed.
CREATE TABLE show_formats (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]*$'),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  proposal JSONB NOT NULL,
  data JSONB,
  -- Bumped each time an approved format's data changes, so a league can tell its cached copy is old.
  version INT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT show_formats_approved_has_data CHECK (status <> 'approved' OR data IS NOT NULL)
);
