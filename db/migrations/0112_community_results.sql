-- Results from everyone (docs/PLAN-new-design.md step 6b): facts are shared per season, one answer per fact whichever
-- couch asks, and every answer anyone sends is a source. Additive: classic keeps reading and writing what it always has.
--
-- 1. episode_research keeps one row per submission. Until now a season episode had one row, replaced (or merged into) by
--    every run: the combined answer every prompt narrows on and every classic screen reads. That row stays, as
--    source = 'combined'; beside it, each submission (a couch's paste, who went home, entered by hand, the bot's runs) is
--    its own row with who sent it, from which couch, and what it answered for (`covers`): the people it was asked about
--    and, for who went home, only eliminations. A submission is never replaced; taking one back sets withdrawn_at.
ALTER TABLE episode_research
  ADD COLUMN source TEXT NOT NULL DEFAULT 'combined'
    CHECK (source IN ('combined', 'paste', 'quick', 'hand', 'bot', 'autopilot', 'tiebreak')),
  ADD COLUMN submitted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  -- { people: [names], kinds: ["elimination"] | null (everything) } or { only: true }: it says yes to its own facts and
  -- nothing about anyone else (ticking a waiting result).
  ADD COLUMN covers JSONB,
  ADD COLUMN withdrawn_at TIMESTAMPTZ;
-- Still one combined row per episode; submissions are as many as people send.
DROP INDEX episode_research_key;
CREATE UNIQUE INDEX episode_research_key ON episode_research (show_id, season_number, episode_number) WHERE source = 'combined';
CREATE INDEX idx_episode_research_submissions ON episode_research (show_id, season_number, episode_number, researched_at)
  WHERE source <> 'combined';

-- 2. A fact's status, from its sources: reported (one source), confirmed (two independent sources agree), disputed (a
--    source or a player disagrees and it isn't settled), canonical (an admin decided, locked) or removed (the sources
--    took it back, or an admin rejected it). `status` stays what it was for classic, and is still the switch for "reaches
--    every league": accepted = in every league on the season (the season sync applies it), pending = waits, rejected =
--    out. NULL fact_status on a pending row is a result staged before this and never reviewed: it is never carried over
--    (the user, 2026-10-24), shown, counted or applied, unless a new submission reports it again.
ALTER TABLE season_decisions
  ADD COLUMN fact_status TEXT CHECK (fact_status IN ('reported', 'confirmed', 'disputed', 'canonical', 'removed')),
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
UPDATE season_decisions SET fact_status = 'canonical', locked_at = COALESCE(decided_at, now()), locked_by = decided_by WHERE status = 'accepted';
UPDATE season_decisions SET fact_status = 'removed', locked_at = COALESCE(decided_at, now()), locked_by = decided_by WHERE status = 'rejected';

-- 3. Which submissions said a fact happened, and how (an elimination's method, a tribe move's tribe). A submission that
--    answered for the person and didn't say so is against it; that's worked out from `covers`, not stored.
CREATE TABLE fact_sources (
  decision_id UUID NOT NULL REFERENCES season_decisions(id) ON DELETE CASCADE,
  research_id UUID NOT NULL REFERENCES episode_research(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  PRIMARY KEY (decision_id, research_id)
);
CREATE INDEX idx_fact_sources_research ON fact_sources(research_id);

-- 4. "Something wrong?": who flagged what, why, a note and a link. decision_id NULL is "something's missing" from the
--    episode. A flag makes its fact disputed until a later answer checks it: kept (it stands), upheld (it comes out),
--    checked (a missing one, looked at again).
CREATE TABLE fact_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  decision_id UUID REFERENCES season_decisions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('didnt-happen', 'wrong-person', 'wrong-episode', 'other', 'missing')),
  note TEXT NOT NULL DEFAULT '',
  link TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'kept', 'upheld', 'checked')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fact_disputes_episode ON fact_disputes(season_id, episode_number, status);
CREATE UNIQUE INDEX fact_disputes_one_open ON fact_disputes(decision_id, user_id) WHERE status = 'open' AND decision_id IS NOT NULL;

-- 5. House rulings: a league keeps a result the shared check corrected. The season sync applies `keeps` (the result as it
--    was) in that league instead of the shared one; the shared facts and stats never see it. Linked leagues rule together
--    (one row each). Dropping the ruling lets the correction apply.
CREATE TABLE league_rulings (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES season_decisions(id) ON DELETE CASCADE,
  keeps JSONB NOT NULL,
  ruled_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, decision_id)
);

-- 6. Who can fill in results on a couch: anyone on it (the default) or only people who run games.
ALTER TABLE couches ADD COLUMN results_by_anyone BOOLEAN NOT NULL DEFAULT true;
