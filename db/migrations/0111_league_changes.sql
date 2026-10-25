-- Recent changes (docs/PLAN-new-design.md step 5): one line per change someone made to a game for others (results,
-- settings, roles, the cast, waivers, the draft), written in the same transaction as the change itself, and shown to
-- everyone on the couch. A player's own moves (their lineup, their pick) aren't changes here. Guards by blast radius:
-- tier 1 (affects others, reversible) and tier 2 (moves standings) carry how to take them back (`undo`), until the next
-- episode airs (`undo_until`); tier 3 (hard to undo) arrives with step 6a. Additive: nothing reads it but the new design.
--
-- One action across several games (results applied to every game on the couch) is one batch: a row per league, one
-- line on the page. `user_id` is who did it; null when it applied on its own. `text` is the line as everyone sees it,
-- written to give nothing away (no names of who went home). `detail` holds what the line can show on request.
CREATE TABLE league_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch UUID NOT NULL,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  tier SMALLINT NOT NULL CHECK (tier BETWEEN 0 AND 3),
  episode INTEGER,
  text TEXT NOT NULL,
  detail JSONB,
  undo JSONB,
  undo_until TIMESTAMPTZ,
  undone_at TIMESTAMPTZ,
  undone_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_league_changes_league ON league_changes(league_id, created_at DESC);
CREATE INDEX idx_league_changes_batch ON league_changes(batch);
