-- The desk's history names a game too (docs/PLAN-desk-parity.md step 6, part 6a): a game's page on the desk Archives it
-- (with Undo), Deletes it (restorable for 30 days), Restores it (with Undo) and Deletes it for good, each a line in its
-- History beside the game's own Recent changes. Changes an existing table's constraint, as 0420 and 0421 did: rehearsed with
-- the step's merge.
ALTER TABLE admin_changes DROP CONSTRAINT IF EXISTS admin_changes_entity_check;
ALTER TABLE admin_changes ADD CONSTRAINT admin_changes_entity_check CHECK (entity IN ('fact', 'castaway', 'season', 'rulebook', 'couch', 'settings', 'show', 'person', 'report', 'game'));
