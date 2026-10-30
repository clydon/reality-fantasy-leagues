-- The desk's history names a person too (docs/PLAN-desk-parity.md step 1, part 1b): Let in, Act as them (its start and
-- its end), Name and email, Reset password, Stop them signing in and Let them back in, each a line on their page, with
-- Undo where it has one. Part 1a's code already wrote 'person' into DeskEntity; nothing wrote a row with it until now.
ALTER TABLE admin_changes DROP CONSTRAINT IF EXISTS admin_changes_entity_check;
ALTER TABLE admin_changes ADD CONSTRAINT admin_changes_entity_check CHECK (entity IN ('fact', 'castaway', 'season', 'rulebook', 'couch', 'settings', 'show', 'person'));
