-- Rulebooks (docs/PLAN-rulebooks-implementation.md section 5, docs/PLAN-new-design.md step R3): what a show does,
-- as the blocks the editor, research and the compiler share (src/lib/game/formats/rulebook-schema.js), with the
-- format data they compile to. One table holds three owners: the library (a template for a built-in or stored
-- format, or a researched rulebook from src/lib/game/formats/library/), a season (what its research and its
-- leagues play by), and a league that made the rules its own.
--
-- Purely additive. shows.format, show_formats, league_rulesets, leagues.ruleset_id and season_rule_changes are
-- untouched and stay what the classic app reads; db/backfill-rulebooks.js fills these from them, and with the
-- rulebooks flag off (app_settings 'rulebooks', the default) nothing reads them.
--
-- THE LEGACY FREEZE (decision 2). A rulebook made from today's rules has compiled_source 'legacy': `compiled` is
-- that format's data exactly, and so is `base`, the data it was frozen from. The first save from the editor
-- compiles the blocks ON TOP OF `base` (rulebook-compile.js), so every event leagues have recorded keeps its
-- rules and questions, and switches it to 'blocks'. `base` never moves after that: a recompile starts from it,
-- never from the previous compile (a moment whose question changed would keep its old rule).
--
-- kind is the schema's four (rulebook-schema.js KINDS): 'sport', not the implementation plan's 'event'. parent_kind
-- 'library' is an entry of src/lib/game/formats/library/ (parent_id its id), which the plan didn't have.
CREATE TABLE rulebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'competition' CHECK (kind IN ('competition', 'series', 'talk', 'sport')),
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('library', 'season', 'league')),
  season_id UUID REFERENCES show_seasons(id) ON DELETE CASCADE,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  is_template BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_force', 'archived')),
  parent_kind TEXT NOT NULL DEFAULT 'none' CHECK (parent_kind IN ('none', 'rulebook', 'builtin', 'show_format', 'league_ruleset', 'library')),
  parent_id TEXT,
  parent_version INT,
  -- The code half that reads the show (formats/index.js formatForRulebook): a built-in's, or a data-only one.
  reader TEXT NOT NULL DEFAULT 'research' CHECK (reader IN ('survivor', 'traitors', 'challenge', 'research', 'league')),
  blocks JSONB NOT NULL,
  compiled JSONB,                       -- FormatData; null while a draft has problems
  compiled_source TEXT NOT NULL DEFAULT 'blocks' CHECK (compiled_source IN ('blocks', 'legacy')),
  base JSONB,                           -- the FormatData it was frozen from; null for one made from blocks alone
  aliases JSONB NOT NULL DEFAULT '{}'::jsonb,
  phase_starts JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { [phaseId]: episode }, season data a person confirms
  -- Where it came from, for the lineage line and for the backfill to keep a legacy copy in step:
  -- { from: 'builtin' | 'show_format' | 'library' | 'league_rulesets', id, version?, researched?, leftOut? }.
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'approved')),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rulebooks_owner_shape CHECK (
    (owner_kind = 'library' AND season_id IS NULL AND league_id IS NULL) OR
    (owner_kind = 'season' AND season_id IS NOT NULL AND league_id IS NULL) OR
    (owner_kind = 'league' AND league_id IS NOT NULL)
  )
);
-- One live rulebook per season and per league; one library row per thing it was made from (a built-in, a stored
-- format, a library entry), so the backfill and a lazy create can't make two.
CREATE UNIQUE INDEX rulebooks_one_per_season ON rulebooks(season_id) WHERE owner_kind = 'season' AND status <> 'archived';
CREATE UNIQUE INDEX rulebooks_one_per_league ON rulebooks(league_id) WHERE owner_kind = 'league' AND status <> 'archived';
CREATE UNIQUE INDEX rulebooks_one_per_source ON rulebooks(parent_kind, parent_id)
  WHERE owner_kind = 'library' AND parent_kind IN ('builtin', 'show_format', 'library');
CREATE INDEX rulebooks_parent ON rulebooks(parent_kind, parent_id);
CREATE INDEX rulebooks_templates ON rulebooks(kind) WHERE is_template;

-- A change to a rulebook from an episode on (plan 4.4's ops, applied by rulebook-patch.js in phase 5). The
-- backfill copies each approved season_rule_changes row here (source 'migration', legacy_id its id); until
-- phase 5 switches research over, season_rule_changes is still what a season's research applies.
CREATE TABLE rulebook_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rulebook_id UUID NOT NULL REFERENCES rulebooks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('show_changed', 'fix', 'league')),
  from_episode INT NOT NULL CHECK (from_episode >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_force', 'no_change', 'withdrawn')),
  ops JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  reach TEXT NOT NULL DEFAULT 'everyone' CHECK (reach IN ('everyone', 'following')),
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'research_check', 'migration', 'commissioner')),
  proposal JSONB,                       -- the pasted research answer (or a migrated change's delta), for review
  checked_through INT,
  base_version INT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  legacy_id UUID UNIQUE,                -- the season_rule_changes row it was copied from (no FK: that table goes in step C)
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rulebook_edits_by_book ON rulebook_edits(rulebook_id, status, from_episode);

-- The season's rulebook, and a league's own copy (NULL: it follows its season's).
ALTER TABLE show_seasons ADD COLUMN rulebook_id UUID REFERENCES rulebooks(id) ON DELETE SET NULL;
ALTER TABLE leagues ADD COLUMN rulebook_id UUID REFERENCES rulebooks(id) ON DELETE SET NULL;
