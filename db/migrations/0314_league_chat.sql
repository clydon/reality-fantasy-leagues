-- A league's room (docs/PLAN-sports-couch.md B1 session 5; docs/design-round/league-chat-spec.md): the couch's talk about a sports
-- league ("football/nfl"), with a thread per real game. Additive:
--
--   chat_messages.sports_league    the room: a couch's (couch_id) about a league; season_id and league_id stay null, so no season's
--                                  chat, classic's league chat or the couch hub's feed reads these rows
--   chat_messages.sports_event     a thread: the provider's game the message is about ("401773001"), or null for the room
--   chat_messages.sports_event_at  that game's start as the author's screen had it, so the phone folds talk written after kickoff
--                                  for anyone hiding sports scores (scores are hidden on the phone, as every sports read is)
--   chat_messages.sports_event_name its words ("Eagles at Jets"), so a thread keeps its name once its week has gone
--   league_chat_reads              how far each person has read a couch's room (forward only), for the Chat tab's badge
--
-- Reactions, edits, deletes and GIFs are chat_messages' own (chat.ts), so a room message behaves as any other.
ALTER TABLE chat_messages ADD COLUMN sports_league TEXT CHECK (sports_league ~ '^[a-z0-9-]+/[a-z0-9.-]+$');
ALTER TABLE chat_messages ADD COLUMN sports_event TEXT CHECK (sports_event ~ '^[A-Za-z0-9-]{1,40}$');
ALTER TABLE chat_messages ADD COLUMN sports_event_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN sports_event_name TEXT CHECK (length(sports_event_name) <= 80);
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_scope_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_scope_check
  CHECK (league_id IS NOT NULL OR (couch_id IS NOT NULL AND (season_id IS NOT NULL OR sports_league IS NOT NULL)));
CREATE INDEX idx_chat_messages_league_room ON chat_messages(couch_id, sports_league, created_at) WHERE sports_league IS NOT NULL;

CREATE TABLE league_chat_reads (
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  league TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (couch_id, league, user_id)
);
