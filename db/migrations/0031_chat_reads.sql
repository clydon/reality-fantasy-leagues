-- Read receipts for league chat: how far each member has read. One row per (league, member), moved
-- forward only, so a message is "read by" everyone whose last_read_at is at or after it.
CREATE TABLE chat_reads (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (league_id, user_id)
);
