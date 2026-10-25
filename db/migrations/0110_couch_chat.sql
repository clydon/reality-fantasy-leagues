-- One chat per couch and show (docs/PLAN-new-design.md step 4). A couch's chat about a season is every message in
-- the couch's games on that season (league_id: classic's linked-group chat, unchanged) plus the messages posted
-- where the couch has no game there yet (a show it only watches): those have no league, and say their couch and
-- season instead. The new design posts into the couch's first game on the season when it has one, so classic keeps
-- showing the same conversation; only a watch-only show's messages carry couch_id and season_id. Additive: nothing
-- classic writes changes, and classic only ever reads by league_id, so it never sees a row without one.
ALTER TABLE chat_messages ALTER COLUMN league_id DROP NOT NULL;
ALTER TABLE chat_messages ADD COLUMN couch_id UUID REFERENCES couches(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN season_id UUID REFERENCES show_seasons(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_scope_check
  CHECK (league_id IS NOT NULL OR (couch_id IS NOT NULL AND season_id IS NOT NULL));
CREATE INDEX idx_chat_messages_couch ON chat_messages(couch_id, season_id, created_at) WHERE league_id IS NULL;

-- How far each person has read a couch's chat about a season, from the new design (forward only, like chat_reads).
-- Reading there also moves chat_reads for the couch's games on the season, so classic's badge agrees; and the new
-- design's unread count takes the later of the two, so reading in classic counts too.
CREATE TABLE couch_chat_reads (
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (couch_id, season_id, user_id)
);
