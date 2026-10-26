-- Rulebooks phase 8: the library and the new-show flow (docs/PLAN-new-design.md step 10 part 3; PLAN-rulebooks-implementation.md
-- 7.9, 7.10, 7.13). Additive: each change only widens what was allowed or adds something new, and classic reads none of it.
--
-- 1. A rulebook someone made with Make it a game (step 10 part 2a) is 'unreviewed', "new until another couch checks it". Now
--    someone on another couch can say it looks right ('checked'), and the desk can take it over ('reviewed': approved_by and
--    approved_at say who and when; its first maker stays its created_by). 'approved' is still the built-ins', the backfill's
--    and the library's templates'.
ALTER TABLE rulebooks DROP CONSTRAINT IF EXISTS rulebooks_review_status_check;
ALTER TABLE rulebooks ADD CONSTRAINT rulebooks_review_status_check CHECK (review_status IN ('unreviewed', 'checked', 'reviewed', 'approved'));

-- 2. Who checked it: one row per couch ("Looks right to us" on How it works). The maker's own couch can't.
CREATE TABLE rulebook_checks (
  rulebook_id UUID NOT NULL REFERENCES rulebooks(id) ON DELETE CASCADE,
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rulebook_id, couch_id)
);

-- 3. Make it a game can start from one of the library's templates (the desk's New show flow): its blocks are the answer to
--    how the show works, and the cast is asked for or read from the listing as before.
ALTER TABLE show_setups DROP CONSTRAINT IF EXISTS show_setups_via_check;
ALTER TABLE show_setups ADD CONSTRAINT show_setups_via_check CHECK (via IN ('bot', 'paste', 'template'));

-- 4. A show someone added by name (no TV listing) reaches the desk's Inbox until the desk has looked at it (Looks fine, or
--    archived). Shows from a listing are real shows and never wait.
ALTER TABLE shows ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE shows ADD COLUMN reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- 5. The desk's history names a show too (Looks fine, archived, a season added from the New show flow).
ALTER TABLE admin_changes DROP CONSTRAINT IF EXISTS admin_changes_entity_check;
ALTER TABLE admin_changes ADD CONSTRAINT admin_changes_entity_check CHECK (entity IN ('fact', 'castaway', 'season', 'rulebook', 'couch', 'settings', 'show'));
