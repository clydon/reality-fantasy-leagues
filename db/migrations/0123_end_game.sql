-- Archive or delete a game (docs/PLAN-new-design.md step 10 part 2b; the mock's settings.js "Archive or delete a game"
-- and guards.js' hold). Additive: classic reads none of this.
--
-- Archiving is in the league's own state (settings.archivedAt / archivedBy): it stays on the couch and the trophy shelf,
-- its table as it stood, and nothing scores it any more (the season sync, moves due, waivers and reminders skip it).
--
-- Deleting is tier 3, restorable for 30 days: the row stays, marked here, out of the couch's games and its linked group,
-- its memberships kept in the Recent changes line that brings it back (league-changes.ts). A deleted game older than
-- 30 days is removed for good the next time anyone deletes one (end-game.ts purge): nothing runs on a schedule.
ALTER TABLE leagues ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE leagues ADD COLUMN deleted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
CREATE INDEX leagues_deleted ON leagues(deleted_at) WHERE deleted_at IS NOT NULL;
