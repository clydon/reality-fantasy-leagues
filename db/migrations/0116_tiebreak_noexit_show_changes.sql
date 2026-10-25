-- How results get in, part 2 (docs/PLAN-new-design.md step 6c): the tie-break run, "nobody went home", and the show
-- changes the couches confirm. Additive.
--
-- 1. "Nobody went home" is a shared fact of its own kind (no castaway: castaway_name ''), so an episode where nobody left
--    can be marked early like any other. The season sync applies it (the league episode's `noExit`) and takes it off; an
--    answer that names someone who left counts against it, and a full answer with nobody out reports it.
ALTER TABLE season_decisions DROP CONSTRAINT season_decisions_kind_check;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_kind_check
  CHECK (kind IN ('elimination', 'event', 'exiled', 'role', 'group', 'noexit'));
ALTER TABLE season_decisions DROP CONSTRAINT season_decisions_shape;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_shape CHECK (
     (kind = 'elimination' AND method <> '' AND event_type = '')
  OR (kind = 'event' AND method = '' AND event_type <> '')
  OR (kind = 'exiled' AND method = '' AND event_type = '')
  OR (kind = 'role' AND method <> '' AND event_type = '')
  OR (kind = 'group' AND event_type = '')
  OR (kind = 'noexit' AND castaway_name = '' AND method = '' AND event_type = ''));

-- 2. The bot's two new runs: a tie-break (the full research asked once more, when a result has been disputed for a day,
--    behind the desk's switch, app_settings 'tiebreak') and a rulebook check (what a show change the couches confirmed
--    adds to the rulebook).
ALTER TABLE bot_research_runs DROP CONSTRAINT bot_research_runs_kind_check;
ALTER TABLE bot_research_runs ADD CONSTRAINT bot_research_runs_kind_check
  CHECK (kind IN ('quick', 'full', 'schedule', 'tiebreak', 'rulebook'));

-- 3. Something the rulebook doesn't have: an episode whose research said the show changed how it's played (its
--    `rulesNote`), and what the couches say about it. One notice per season episode (made when the first couch answers),
--    its votes one per person, counted by couch: two couches agreeing it's new adds it to the season's rulebook from that
--    episode (a 'community' edit), a majority saying it isn't puts it away, and a split goes to the desk.
CREATE TABLE rulebook_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INT NOT NULL CHECK (episode_number >= 1),
  -- What research said, as it said it (the first answer for the episode that had a note).
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checking', 'added', 'not_new', 'desk')),
  -- Why it's at the desk, or what was added, in a line.
  line TEXT,
  edit_id UUID REFERENCES rulebook_edits(id) ON DELETE SET NULL,
  run_id UUID REFERENCES bot_research_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  UNIQUE (season_id, episode_number)
);
CREATE INDEX idx_rulebook_notices_open ON rulebook_notices (status) WHERE status IN ('open', 'checking', 'desk');

CREATE TABLE rulebook_notice_votes (
  notice_id UUID NOT NULL REFERENCES rulebook_notices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  is_new BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

ALTER TABLE rulebook_edits DROP CONSTRAINT rulebook_edits_source_check;
ALTER TABLE rulebook_edits ADD CONSTRAINT rulebook_edits_source_check
  CHECK (source IN ('admin', 'research_check', 'migration', 'commissioner', 'community'));
