-- What scores' answer settles a row at a time (docs/PLAN-rulebook-research.md): Use these changes marks the accepted rows
-- used and the declined ones put away, and a new-this-season moment past the reader's Where I am mark stays open, unseen,
-- until they're past it. `settled` is that map, moment id -> 'used' | 'dismissed'; settled_at (0432) is set once nothing
-- in the answer is left open.
--
-- Additive: a column with a default.
ALTER TABLE rulebook_answers ADD COLUMN settled JSONB NOT NULL DEFAULT '{}'::jsonb;
