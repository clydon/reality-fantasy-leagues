-- Web Push notifications: which devices can receive them, and which kinds each person wants.
--
-- Sending lives in src/lib/server/push-core.js (shared by the Next routes and db/wiki-sync.js).

-- One row per DEVICE, not per person: someone with the app installed on a phone and a laptop has two
-- subscriptions and should get the push on both. `endpoint` is the push service URL the browser
-- handed out (FCM for Chrome/Android, Apple's for iOS 16.4+ home-screen apps, Mozilla's for
-- Firefox) and is globally unique, which is what makes re-subscribing the same device an upsert
-- rather than a duplicate.
--
-- Rows are deleted by push-core.js when the push service answers 404/410 -- the app was uninstalled
-- or notification permission was revoked -- so this table doesn't slowly fill with dead devices
-- that every push has to try and fail against.
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  -- The subscription's encryption keys (base64url), from PushSubscription.toJSON().keys.
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- Only for a human reading the table ("which of my devices is this?"); never parsed.
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Per-person notification preferences, stored as the set of DISABLED types rather than enabled ones.
-- That inversion is the point: every type is on by default, and a type added in a later release is
-- on for everyone immediately, with no backfill -- nobody can have disabled something that didn't
-- exist yet. A missing row simply means "everything on".
--
-- Shape: { "chat": true, "newBet": true } -- keys are the notification type ids listed in
-- push-core.js's NOTIFICATION_TYPES.
CREATE TABLE notification_prefs (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  disabled JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
