-- The admin's desk (docs/PLAN-new-design.md step 6b part 2): results settle by community, and the admin is the exception
-- desk. Additive.
--
-- 1. What the desk changed, with its undo: a fact decided, a castaway overridden, a tribe that was a secret role, a
--    couch handed on, a setting, a rulebook edited. One row per change; `undo` says how to take it back (null: it can't
--    be). A rulebook's own edits stay in rulebook_edits; this is the line its History shows, and its undo.
CREATE TABLE admin_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL CHECK (entity IN ('fact', 'castaway', 'season', 'rulebook', 'couch', 'settings')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  text TEXT NOT NULL,
  before JSONB,
  after JSONB,
  undo JSONB,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  undone_at TIMESTAMPTZ,
  undone_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_changes_entity ON admin_changes(entity, entity_id, created_at DESC);

-- 2. Locks. A locked rulebook is changed by the admin only (couches' suggestions still reach the Inbox); a locked
--    castaway can't be changed by a commissioner's cast entry. A fact's lock is season_decisions.locked_at (0112).
ALTER TABLE rulebooks ADD COLUMN locked_at TIMESTAMPTZ, ADD COLUMN locked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE season_cast ADD COLUMN locked_at TIMESTAMPTZ;

-- 3. A season's leagues play by its rulebook. The rulebooks flag (app_settings 'rulebooks', 0107) turns that on for
--    every season at once; this turns it on for one, so a season can go first (the couch's Survivor 51, say) and come
--    back off on its own. Off, its leagues play by their show's format exactly as before.
ALTER TABLE show_seasons ADD COLUMN rulebook_live BOOLEAN NOT NULL DEFAULT false;

-- 4. "Suggest a fix" from How it works: what someone on a couch says a rulebook got wrong, for the admin's Inbox.
CREATE TABLE rulebook_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rulebook_id UUID REFERENCES rulebooks(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  about TEXT NOT NULL CHECK (about IN ('segment', 'wayOut', 'scores', 'other')),
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
  settled_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rulebook_suggestions_open ON rulebook_suggestions(status, created_at);
