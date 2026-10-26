-- Watch along's reactions (docs/PLAN-new-design.md step 13 part 1; the mock's index.html openWatch and watching.js). Additive, and
-- classic reads none of it.
--
-- A reaction is something someone said at a moment of an episode while watching along: a comment, one of four quick reactions or a
-- GIF, pinned to the episode's own runtime (`runtime_ms`, from the start of the episode as the watcher's clock had it), and said to
-- the couch they watched along with (`couch_id`; none when they're on their own: then it's only theirs). Shown to the rest of that
-- couch only once they reach that moment and 30 seconds more (never before), and only from people who follow the show openly
-- (a private watcher's stay theirs).
--
-- `kind`: 'text' (a comment: `text`), 'gif' (`gif` is { id, url, w, h, title } from GIPHY, its url on GIPHY's own media hosts),
-- or a quick reaction: 'fire', 'laugh', 'eye', 'crown'.
CREATE TABLE watch_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  runtime_ms INTEGER NOT NULL CHECK (runtime_ms >= 0 AND runtime_ms <= 21600000),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  couch_id UUID REFERENCES couches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'gif', 'fire', 'laugh', 'eye', 'crown')),
  text TEXT CHECK (text IS NULL OR char_length(text) BETWEEN 1 AND 200),
  gif JSONB CHECK (gif IS NULL OR jsonb_typeof(gif) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'text') = (text IS NOT NULL)),
  CHECK ((kind = 'gif') = (gif IS NOT NULL))
);
-- A couch's reactions on an episode in runtime order (the watch along's poll: those since a runtime, through another).
CREATE INDEX watch_reactions_couch ON watch_reactions (season_id, episode, couch_id, runtime_ms);
-- Someone's own, for their own replay and how many they've sent lately.
CREATE INDEX watch_reactions_user ON watch_reactions (user_id, season_id, episode);
