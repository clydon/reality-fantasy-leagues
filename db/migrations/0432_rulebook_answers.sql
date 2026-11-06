-- Research on a rulebook, through our bot (docs/PLAN-rulebook-research.md): Check for changes (the rulebook prompt, this
-- rulebook as its starting point) and What scores (rulebook-scores.js: every moment on the ladder, and what's missing) ask
-- our bot through the desk's Run now queue, or take an answer pasted from Ask an AI, and the answer is staged for the
-- rulebook page's review: nothing changes until an admin puts its changes in the draft and saves.
--
--   rulebook_answers   one per answer: the rulebook, what was asked ('check' or 'scores'), where it came from ('bot' or
--                      'paste'), the answer as given, who asked or pasted it and when, and when it was settled (put in the
--                      draft, or put away) and by whom. Only a rulebook's latest unsettled answer of each kind is reviewed.
--
-- desk_runs (0424) takes two more kinds, 'rulebook' (Check for changes) and 'scores', as episode 0 of the rulebook's season,
-- and `rulebook_id`, which those rows set (a season's rulebook can be replaced; the run names the one it asked for).
--
-- Additive: a new table, a nullable column and a check widened on 0424's table.
CREATE TABLE rulebook_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rulebook_id UUID NOT NULL REFERENCES rulebooks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('check', 'scores')),
  source TEXT NOT NULL CHECK (source IN ('bot', 'paste')),
  answer TEXT NOT NULL,
  by_user TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  settled_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  settled_as TEXT CHECK (settled_as IN ('used', 'dismissed'))
);
CREATE INDEX rulebook_answers_open ON rulebook_answers (rulebook_id, kind, created_at DESC) WHERE settled_at IS NULL;

ALTER TABLE desk_runs ADD COLUMN rulebook_id UUID REFERENCES rulebooks(id) ON DELETE CASCADE;
ALTER TABLE desk_runs DROP CONSTRAINT desk_runs_kind_check;
ALTER TABLE desk_runs ADD CONSTRAINT desk_runs_kind_check CHECK (kind IN ('quick', 'full', 'schedule', 'trivia', 'bingo', 'cast', 'rulebook', 'scores'));
