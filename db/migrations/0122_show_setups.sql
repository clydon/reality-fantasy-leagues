-- Make it a game (docs/PLAN-new-design.md step 10 part 2a): a show someone added to follow ("Not a game yet",
-- shows.set_up_at NULL) is set up as a game by asking ChatGPT how it works and who's in it. Additive: classic reads none
-- of this.
--
-- show_setups: one attempt at setting up a season's show, shared by everyone who taps Make it a game while it's open (a
--   second tap joins it, as One tap's runs are joined). Its answers are kept as the chat sent them; the review is worked
--   out from them each time it's read, so changing the kind on the review never loses anything ChatGPT found.
--   via        'bot' (Ask ChatGPT for me: our bot asks, after the request answers) or 'paste' (copy and paste it yourself)
--   stage      'rules' (asking how the show works), 'cast' (asking who's in it), 'ready' (both in: the review),
--              'failed' (the bot couldn't: message says why; ask again or paste), 'done' (set up: done_at)
--   asking_at  a bot ask in flight since then (a stale one, cut off by the route's 300 s, can be asked again)
--   kind/start the kind chosen on the review with Change (NULL: what ChatGPT's answer says, else the listing's guess)
--   cast_from  where the cast answer came from: 'chat' (the cast prompt) or 'listing' (TVmaze's cast, a series or talk show)
--   rulebook_id  the season's rulebook it made (done)
CREATE TABLE show_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  started_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  via TEXT NOT NULL CHECK (via IN ('bot', 'paste')),
  stage TEXT NOT NULL DEFAULT 'rules' CHECK (stage IN ('rules', 'cast', 'ready', 'failed', 'done')),
  asking_at TIMESTAMPTZ,
  message TEXT,
  rules_answer TEXT,
  cast_answer TEXT,
  cast_from TEXT CHECK (cast_from IN ('chat', 'listing')),
  kind TEXT CHECK (kind IN ('competition', 'series', 'talk', 'sport')),
  start TEXT CHECK (start IN ('reality', 'scripted')),
  seconds REAL,
  rulebook_id UUID REFERENCES rulebooks(id) ON DELETE SET NULL,
  done_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One open attempt per season (a done one stays, as who set the show up and how).
CREATE UNIQUE INDEX show_setups_open ON show_setups (season_id) WHERE done_at IS NULL;
-- A person's attempts today (asking our bot is capped per person a day).
CREATE INDEX show_setups_started_by ON show_setups (started_by, created_at DESC);
