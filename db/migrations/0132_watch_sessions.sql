-- Who's on now (docs/PLAN-new-design.md step 13 part 2; the mock's index.html openWatch: "riley is watching now · 40s ahead" with
-- her mark on the bar, and hubplus.js's On now). Additive, and classic reads none of it.
--
-- A watch session is an open watch along's clock, kept on the server so the couch can see who's watching right now and where they
-- are: the episode, the couch it's watched with (none alone: then nobody else sees it), how (streaming, or live TV), and the clock:
-- where it stood (`clock_ms`, ms into the episode) and since when it's been running (`running_since`, the server's time; NULL while
-- paused or in an ad break, `ad` saying which). Written when it starts, pauses, moves or ends; `version` counts those writes (part 3's
-- together sessions poll it).
--
-- Who's in one is watch_session_people. In part 2 that's only whoever opened it (opening the same episode on the same couch again
-- carries on in it); part 3's together sessions (`together`) put several people in one, one clock for them all. Each person's
-- `seen_at` is their heartbeat, sent while the watch along is open and in front; someone is watching now while it's recent and they
-- haven't left (`left_at`). Worked out when read: nothing sweeps them, and nothing runs on a timer.
CREATE TABLE watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  couch_id UUID REFERENCES couches(id) ON DELETE CASCADE,
  started_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  together BOOLEAN NOT NULL DEFAULT false,
  mode TEXT NOT NULL CHECK (mode IN ('stream', 'live')),
  clock_ms INTEGER NOT NULL DEFAULT 0 CHECK (clock_ms >= 0 AND clock_ms <= 21600000),
  running_since TIMESTAMPTZ,
  ad BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (ad AND running_since IS NOT NULL))
);
-- Your own watch along of an episode on a couch (or alone) is one session; together sessions (part 3) are each their own.
CREATE UNIQUE INDEX watch_sessions_own ON watch_sessions (started_by, season_id, episode, (COALESCE(couch_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  WHERE NOT together;
CREATE INDEX watch_sessions_couch ON watch_sessions (couch_id, season_id, episode);

CREATE TABLE watch_session_people (
  session_id UUID NOT NULL REFERENCES watch_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, user_id)
);
-- Who's watching now: only the heartbeats of the last minute are ever looked for.
CREATE INDEX watch_session_people_seen ON watch_session_people (seen_at);
CREATE INDEX watch_session_people_user ON watch_session_people (user_id);
