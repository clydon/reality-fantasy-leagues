-- Everyone onto the new design (the user, 2026-10-31: HANDOFF's "switch the couch", widened to every account). Every
-- saved choice becomes 'new' and a new row starts there; src/lib/server/ui-choice.ts reads an account with no row as new
-- too. Classic stays one tap away (Settings › Your account › Back to the classic design), and a choice made after this
-- sticks. Step C (docs/PLAN-new-design.md) drops the column with classic.
UPDATE user_settings SET ui = 'new', updated_at = now() WHERE ui <> 'new';
ALTER TABLE user_settings ALTER COLUMN ui SET DEFAULT 'new';
