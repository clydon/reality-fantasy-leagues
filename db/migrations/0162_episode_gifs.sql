-- React with a GIF (the user, 2026-11-01; docs/PLAN-gif-reactions.md): after an episode, one GIF of your own choosing, searched on
-- KLIPY as the chat's are, in place of Rate it's stars (shelved: episode_ratings and its rows stay, nothing reads them now). One
-- per person per episode of a season, changed any time; kept as the chat keeps one ({ id, url, w, h, title }, only from KLIPY's own
-- media hosts: watch-along.ts cleanGif). Only an episode that's aired and that you've seen can have yours, and anyone's is only
-- sent to someone who has seen it (episode-gifs.ts). Additive, and classic reads none of it.
CREATE TABLE episode_gifs (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  gif JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id, episode)
);
-- The reveal's slide and the GIF sheet read one episode's; Episodes reads a season's.
CREATE INDEX episode_gifs_episode ON episode_gifs (season_id, episode);

-- What your couch sees: "My episode GIFs" takes the place of "My episode ratings" (share_ratings stays, unread), starting from
-- what each person chose for their ratings.
ALTER TABLE user_settings ADD COLUMN share_gifs BOOLEAN NOT NULL DEFAULT true;
UPDATE user_settings SET share_gifs = share_ratings;
