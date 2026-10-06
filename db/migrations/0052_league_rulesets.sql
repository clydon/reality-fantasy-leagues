-- A commissioner's own copy of a show's scoring rules (docs/PLAN-scoring-rules-as-data.md, "Who owns
-- what", decided 2026-10-05; scoped down on 2026-10-06 to just this table -- masters are NOT touched or
-- duplicated here. The built-in formats' rules stay code (src/lib/game/formats/); an AI-researched
-- show's master rules stay show_formats (migration 0049). Neither gets a row here. This table holds only
-- the thing that's actually missing: a league forking off its own editable copy.
--
-- A copy can be forked from a built-in (by id, no row to reference -- see parent_kind below), an
-- approved show_formats row, or another league's shared copy. Whichever it came from, `data` is a full
-- format data half (the same JSON shape formatProblems validates and buildDataFormat resolves -- see
-- src/lib/game/formats/define.js, custom.js), a standalone snapshot: editing a copy never touches its
-- parent, and a parent changing never touches an existing copy (parent_version is what lets a later UI
-- say "v3 is out").
--
-- Purely additive: no existing row is read or changed. A league with no ruleset_id behaves exactly as
-- it does today -- see src/lib/game/state-logic.js formatOf, which checks this table's cached data only
-- when present and falls through to the untouched showFormat/showFormatData path otherwise.
CREATE TABLE league_rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The league that owns (created) this copy. Not the same thing as "the league currently using it" --
  -- see leagues.ruleset_id below -- because a row can outlive its creator no longer pointing at it, if
  -- some other league's copy still names it as a parent (see db/league-rulesets.js's abandon logic).
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  -- Bumped on every edit, so a league using a COPY OF this (parent_kind='league_ruleset' elsewhere) can
  -- tell its cached parent_version is behind -- same idea as show_formats.version.
  version INT NOT NULL DEFAULT 1,
  -- What this was forked from, if anything. 'none' is "written from scratch" (parent_id/parent_version
  -- both null). parent_id's meaning depends on parent_kind, so -- like shows.format (migration 0049's
  -- own reasoning) -- it's TEXT with no foreign key: a 'builtin' id is a bare code-registry string
  -- ("survivor") that is never a row; a 'show_format' id is show_formats.id; a 'league_ruleset' id is
  -- another row in this same table, stored as text since one column can't carry two different FK targets.
  parent_kind TEXT NOT NULL DEFAULT 'none' CHECK (parent_kind IN ('builtin', 'show_format', 'league_ruleset', 'none')),
  parent_id TEXT,
  -- Built-ins aren't versioned (the code is just whatever it is today), so a 'builtin' parent always
  -- carries a null version. A 'show_format' or 'league_ruleset' parent carries the version number its
  -- source had at the moment of the fork -- a fixed snapshot, never updated after the fact.
  parent_version INT,
  CONSTRAINT league_rulesets_parent_shape CHECK (
    (parent_kind = 'none'           AND parent_id IS NULL     AND parent_version IS NULL) OR
    (parent_kind = 'builtin'        AND parent_id IS NOT NULL AND parent_version IS NULL) OR
    (parent_kind = 'show_format'    AND parent_id IS NOT NULL AND parent_version IS NOT NULL) OR
    (parent_kind = 'league_ruleset' AND parent_id IS NOT NULL AND parent_version IS NOT NULL)
  ),
  -- 'shared' lets another league's commissioner read and copy it (never move or change it -- copying
  -- always makes a brand new row). No UI sets this yet; it defaults private.
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
  -- Not enforced anywhere yet -- the hook for a future catalog-trust question (a public browse list of
  -- shared rulesets), same open question as docs/PLAN-ai-generated-show-formats.md's for stored formats.
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'approved')),
  -- Reserved, unused: a future mid-season edit lock. Checked nowhere yet -- see the phase-1 plan doc.
  locked_at TIMESTAMPTZ,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_league_rulesets_league ON league_rulesets(league_id);
-- Only the "browse shared rulesets" listing filters on this; a partial index keeps it to just those rows.
CREATE INDEX idx_league_rulesets_shared ON league_rulesets(visibility) WHERE visibility = 'shared';

-- A league's real, relational pointer to its own copy -- the group_id precedent (migration 0040): a
-- league genuinely owns this row (cascade/relational semantics matter), unlike showFormat/showFormatData
-- below, which is a natural-key catalog lookup. Null for every league that hasn't customised anything,
-- which is every league today.
ALTER TABLE leagues ADD COLUMN ruleset_id UUID REFERENCES league_rulesets(id) ON DELETE SET NULL;
CREATE INDEX idx_leagues_ruleset ON leagues(ruleset_id);
