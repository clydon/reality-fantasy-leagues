-- Notifications by moment (docs/PLAN-new-design.md step 15 part 2). Additive; classic keeps reading notification_prefs as it
-- did (its per-type switches still work: a moment is its types, src/lib/moments.js).
--
-- The bell: what's happened on your couch since you last looked, kept as a list whatever your pushes say (push-core.js writes a
-- row for everyone a push is for, before it checks whether they want the push). One row per person per notice, worded for that
-- person as the spoiler guard let it out when it was written; `spoils` is the episode whose results the words give away, and
-- `safe` the words for someone not past it (read back through the guard again, so moving where you are back, or turning Hide
-- scores on, never shows an old row's names). `key` makes a notice once per person ("early:<season>:<n>": three linked games'
-- results are one notice). Rows older than 30 days go when a newer one is written for that person (no timer). Chat messages
-- aren't kept here (the Chat tab has its own count). Not in the backups: notices, not the game.
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  key TEXT,
  season_id UUID REFERENCES show_seasons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  -- Where tapping it goes in the new design (the bell is the new design's).
  link TEXT NOT NULL,
  spoils INTEGER,
  safe JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_once ON notifications(user_id, key) WHERE key IS NOT NULL;

-- When you last opened the bell (its count is what's newer), and the time zone your phone is in, kept from the home read (and
-- classic's /api/me) so a push says the reader's own time ("Thu 5:00 PM PDT"). Both backed up with user_settings.
ALTER TABLE user_settings ADD COLUMN notes_read_at TIMESTAMPTZ;
ALTER TABLE user_settings ADD COLUMN tz TEXT CHECK (length(tz) <= 64);

-- Couch chat: Every message, or Quiet on episode nights (NULL: the recommended one: nothing while a message is folded for you,
-- chat-fold.ts); Never is classic's `chat` type switched off in `disabled`. `shows`: a show's moments switched off for that
-- show alone ({ "<shows.id>": ["chat", "lineup"] }), from a show's ⋯ menu. Both backed up with notification_prefs.
ALTER TABLE notification_prefs ADD COLUMN chat TEXT CHECK (chat IN ('all', 'quiet'));
ALTER TABLE notification_prefs ADD COLUMN shows JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Tonight's "Waivers ran" plate goes once you've watched the run, on every phone (it was per device). A seen mark: not backed up.
CREATE TABLE waiver_runs_seen (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, league_id, period_id)
);

-- A flag's settling is told to whoever raised it once (community-results.ts tellSettled, after the season sync): flags settled
-- before this migration count as told already, so nobody hears about an old one. Backed up with fact_disputes.
ALTER TABLE fact_disputes ADD COLUMN told_at TIMESTAMPTZ;
UPDATE fact_disputes SET told_at = COALESCE(settled_at, now()) WHERE status <> 'open';
