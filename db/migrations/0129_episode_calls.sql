-- Call it, Weekly Calls and the couch's polls (docs/PLAN-new-design.md step 12 part 2; the mock's watching.js callSheet,
-- show.js predictSheet, index.html pollSheet and banishSheet, rulebook.js Weekly Calls). Additive, and classic reads none of it.
--
-- A call is one person's, for one episode of one season, whichever couch they're on (as a rating is): who goes home (the cast
-- pick, `question` 'out', answered with a season_cast id) and the show's other one-tap calls (`question` 'm:<moment>', answered
-- 'yes' or 'no'). Made before the episode airs and changeable until then; private until airtime, and after it only shown to
-- someone who has seen the episode (calls.ts). Graded from the season's shared results (season_decisions): no grade is stored.
-- A public pool's Who goes home? is the same row (its 'out' call), and Weekly Calls, the talk show's season game, counts them.
CREATE TABLE episode_calls (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 120),
  answer TEXT NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id, episode, question)
);
-- An episode's calls (the couch's, once it's aired), and a season's for the tallies.
CREATE INDEX episode_calls_episode ON episode_calls (season_id, episode);

-- What happened, for a call the season's results don't settle: a talk show's moments ("Did anyone break character?"), which the
-- couch says as it watches (rulebook-schema.js KINDS.talk). Said by someone who has seen the episode; two on the couch agreeing
-- settles it (alone on the show, your own say does). One person's, like a call; never shown to someone who hasn't seen it.
CREATE TABLE episode_call_says (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 120),
  happened BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id, episode, question)
);
CREATE INDEX episode_call_says_episode ON episode_call_says (season_id, episode);

-- A poll anyone on a couch starts for a show's next episode ("Who does the couch think goes next?"): the cast still in, or two to
-- four options of their own. Open until the episode airs (`closes_at`, its air time when it was started); the votes are hidden
-- until then, and after it only shown to someone who has seen the episode. `options` is [{ key, label }] (a cast poll's keys are
-- season_cast ids). Seen only by the couch's people who share the show and have seen the episode before it (polls.ts).
CREATE TABLE couch_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 80),
  cast_poll BOOLEAN NOT NULL DEFAULT false,
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX couch_polls_couch ON couch_polls (couch_id, season_id, episode);

-- One vote each, changeable until the poll closes.
CREATE TABLE couch_poll_votes (
  poll_id UUID NOT NULL REFERENCES couch_polls(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  option TEXT NOT NULL CHECK (char_length(option) BETWEEN 1 AND 120),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
