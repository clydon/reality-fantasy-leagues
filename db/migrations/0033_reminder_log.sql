-- Reminders sent by db/reminders.js (the hourly job): one row per person, league, kind of thing
-- still undone (lineup / pick / prediction), episode, and reminder window (24h or 2h before it airs).
-- The primary key IS the "at most once" rule -- the job inserts first and only pushes if the insert
-- landed, so an hourly run can never repeat a reminder.
CREATE TABLE reminder_log (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  episode_number INT NOT NULL,
  reminder_window TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, league_id, kind, episode_number, reminder_window)
);
