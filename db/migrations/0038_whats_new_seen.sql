-- The one-time "What's New" popup (src/lib/whats-new.ts): the release id this account last saw and
-- dismissed. Per account, not per browser, so it shows once -- not again on every new device.
ALTER TABLE user_settings ADD COLUMN whats_new_seen TEXT;
