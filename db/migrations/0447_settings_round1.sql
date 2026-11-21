-- Settings, Round 1 (docs/PLAN-settings-overhaul.md; docs/design-round/settings-r1-spec.md): two places a notification is set
-- that had no storage.
--
-- Mute a show (A6, C16), from the show's own Notifications: { "<show id>": "<ISO time it ends>" | "forever" }. A muted show's
-- results, couch activity and chat aren't pushed (reminders before your moves lock still are, and everything still lands in the
-- bell). An end that has passed is just ignored, so nothing needs a job to tidy it; the next mute or unmute of that show
-- rewrites its key.
ALTER TABLE notification_prefs ADD COLUMN muted JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Chat notifications on one couch (A9, C26), set on the couch's page: NULL follows your account's Couch chat choice
-- (notification_prefs.chat and disabled.chat); 'all', 'quiet' (skip possible spoilers) or 'off' is this couch's own.
ALTER TABLE couch_members ADD COLUMN chat_notify TEXT CHECK (chat_notify IN ('all', 'quiet', 'off'));
