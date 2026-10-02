-- Linked leagues (src/lib/server/league-groups.ts): the same friends playing several leagues on the
-- same season can link them, and linked leagues share one chat and one "reveal" -- revealing an
-- episode's results in one reveals them in all. Linked by a commissioner of every league involved.
--
-- Chat isn't moved: each message keeps its league_id, and a group's chat is all its leagues'
-- messages read together, so unlinking simply splits them back.
CREATE TABLE league_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leagues ADD COLUMN group_id UUID REFERENCES league_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_leagues_group ON leagues(group_id);

-- Chat's automated result lines ("X -- Voted Out", "X guessed on ...") are retired -- the app shows
-- all of that better now, and in a shared or spoiler-protected chat they were noise or spoilers.
-- In their place, one line when someone reveals an episode, so the group knows who's caught up.
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check CHECK (type IN ('message', 'system', 'reveal'));
