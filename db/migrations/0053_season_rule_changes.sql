-- Season rule changes (docs/PLAN-season-rule-changes.md): a show's rules changing partway through a
-- season, recorded per season as an additive change layered on the show's format -- never an edit to
-- the format itself, which every season of the show shares.
--
-- One row per "check for rule changes" an admin records:
--   draft      a pasted check answer under review (`proposal` is what the review screen edits)
--   approved   in force for the season from effective_episode on; `delta` is derived from the proposal
--              and validated (src/lib/game/formats/season-check.js, season-changes.js). Research asks
--              its questions from that episode on, and every league on the season is offered it --
--              each league's commissioner decides whether it scores (settings.adoptedRuleChanges).
--   no_change  a check that found nothing new, through checked_through: how the season row knows a
--              check was done
--   withdrawn  was approved, then taken back. Kept, because a league that adopted it keeps its frozen
--              copy until its commissioner removes it.
--
-- Purely additive: no existing row is read or changed.
CREATE TABLE season_rule_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'no_change', 'withdrawn')),
  -- The first episode the change applies to. Null only while a draft hasn't said (and for no_change).
  effective_episode INT CHECK (effective_episode IS NULL OR effective_episode >= 1),
  -- The last aired episode the check covered, as the answer reported it.
  checked_through INT CHECK (checked_through IS NULL OR checked_through >= 1),
  summary TEXT,
  proposal JSONB NOT NULL,
  delta JSONB,
  -- What the check was run against: the show's format id and, for a stored format, its version.
  base_format TEXT,
  base_version INT,
  -- Bumped each time an approved change is edited, so a league can tell its adopted copy is older.
  version INT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT season_rule_changes_approved_shape CHECK (
    status NOT IN ('approved', 'withdrawn') OR (delta IS NOT NULL AND effective_episode IS NOT NULL)
  )
);
CREATE INDEX idx_season_rule_changes_season ON season_rule_changes(season_id, status);
