-- Make it ours (docs/PLAN-new-design.md step 6b part 3): a couch's own copy of its season's rulebook is a league-owned
-- rulebook (0107, provenance.ours) that each of the couch's games points at. A moment the couch adds is answered by the
-- couch, here. Additive.
--
-- What one person on the couch says happened for one of its own moments in an episode: who did it, and how many times
-- for a moment counted every time it happens. Whoever runs the couch's games settles it on their own; otherwise two
-- people agreeing do. What's settled goes into the couch's games as that moment's results; nothing here is shared with
-- another couch or the season's stats.
CREATE TABLE couch_answers (
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INT NOT NULL CHECK (episode_number >= 1),
  moment_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  picks JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{ name, times? }]
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (couch_id, season_id, episode_number, moment_id, user_id)
);
