-- Reports on the desk (docs/PLAN-desk-parity.md step 2): Find › Reports and a report's page, read, Mark done (and Reopen,
-- with Undo) and Delete. Classic deleted a report once it was dealt with, so whatever was left was open; the desk keeps a
-- dealt-with report as Done (Reports › Done) and deletes only when asked. Additive columns on issue_reports (0001):
--
--   done_at, done_by   when it was marked done and by whom (NULL: open, in the Inbox).
--   sent_from          where it was sent from, as the desk says it ({ device, installed }: "an iPhone", the installed app),
--                      worked out when it's sent (the user agent, and the app saying it's installed); NULL for older ones.
--
-- And the desk's History names a report too (admin_changes.entity 'report'): Mark done and Reopen, each with Undo, and its
-- Delete. Changes an existing table's constraint, as 0420 did: rehearsed with the step's merge.
ALTER TABLE issue_reports ADD COLUMN done_at TIMESTAMPTZ;
ALTER TABLE issue_reports ADD COLUMN done_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE issue_reports ADD COLUMN sent_from JSONB;
CREATE INDEX idx_issue_reports_open ON issue_reports (created_at DESC) WHERE done_at IS NULL;

ALTER TABLE admin_changes DROP CONSTRAINT IF EXISTS admin_changes_entity_check;
ALTER TABLE admin_changes ADD CONSTRAINT admin_changes_entity_check CHECK (entity IN ('fact', 'castaway', 'season', 'rulebook', 'couch', 'settings', 'show', 'person', 'report'));
