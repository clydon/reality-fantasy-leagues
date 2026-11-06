-- The first-time tour (docs/PLAN-first-time-tour.md, the user, 2026-10-31): when this account first finished or skipped it
-- (null: it hasn't, so Home plays it once), and the furthest step it got to (its step count when finished). Per account, not
-- per device: an iPhone's Home Screen app is a device of its own. Backed up with user_settings.
ALTER TABLE user_settings ADD COLUMN tour_seen_at TIMESTAMPTZ;
ALTER TABLE user_settings ADD COLUMN tour_reached SMALLINT;
