-- Rate it and the couch verdict (docs/PLAN-new-design.md step 12 part 1; the mock's watching.js rateSheet, episode.js rate5 and
-- couchpages.js verdictsPage): after an episode, one to five stars and an optional one-line take. The couch verdict is the average
-- of the couch's ratings; your taste twin is who on the couch rates most like you. Additive, and classic reads none of it.
--
-- A rating is one person's, for one episode of one season, whichever couch they're on (as where you are is): each couch's verdict
-- counts the ratings of the people on it who share the show (guard.ts visibleFollows: following it, not privately). Only an episode
-- that's aired and that you've seen can be rated (ratings.ts), and a rating, a take or a verdict about an episode is only sent to
-- someone who has seen it. `take` is optional, 140 characters at most.
CREATE TABLE episode_ratings (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  take TEXT CHECK (take IS NULL OR char_length(take) BETWEEN 1 AND 140),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id, episode)
);
-- A verdict reads an episode's ratings; the hub reads the couch's people's.
CREATE INDEX episode_ratings_episode ON episode_ratings (season_id, episode);
