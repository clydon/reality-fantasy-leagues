-- Episode results are decided ONCE per season, by an admin, and reach every league automatically.
--
-- Until now each league got its own copy of every decision (wiki_proposal_items, 0009, and
-- episode_research_items, 0015) and its commissioner accepted or rejected each one. That was the
-- wrong unit: "did Kyle find an idol in episode 3" has one answer, whichever league is asking, so
-- ten leagues meant ten people doing the same review -- and ten chances for them to disagree about
-- a fact. The cast already moved to this shape in 0011 for exactly this reason.
--
-- So: both connectors stage into season_decisions; an admin decides each row in Admin > Shows &
-- Seasons; accepted rows are applied to every league on the season, gated per league by its reveal
-- pointer (a catching-up league gets an episode's results when it reveals that episode). The two
-- per-league tables stay as history and stop being written.
--
-- Decided rows are never deleted by a re-pull or re-research (the upsert only moves pending rows),
-- so the table is also the long-term record of what was decided, by whom, and when.
CREATE TABLE season_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  -- By number: leagues each have their own episode ids, and numbers are what both sources give us.
  episode_number INTEGER NOT NULL,
  post_merge BOOLEAN NOT NULL DEFAULT false,
  kind TEXT NOT NULL CHECK (kind IN ('elimination', 'event', 'exiled')),
  -- The season cast's own spelling (season_cast.name) whenever the source's name resolved to one,
  -- so the same person from the wiki and from research lands on the same row.
  castaway_name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT '',       -- elimination only, an EXIT_METHODS value
  event_type TEXT NOT NULL DEFAULT '',   -- event only, an ACTIVE_ROSTER_EVENTS id
  confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  -- Which connector(s) proposed it. Both true means the wiki's tables and web research agree, which
  -- is worth showing a reviewer.
  from_wiki BOOLEAN NOT NULL DEFAULT false,
  from_research BOOLEAN NOT NULL DEFAULT false,
  -- SET NULL, not CASCADE: a re-read replaces its extraction/research row, and a decision already
  -- made must outlive the read that proposed it.
  extraction_id UUID REFERENCES wiki_extractions(id) ON DELETE SET NULL,
  research_id UUID REFERENCES episode_research(id) ON DELETE SET NULL,
  -- URLs behind a research claim (a wiki claim is pinned by the extraction's revision ids instead).
  sources TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  -- What was actually committed when the admin corrected it before accepting
  -- ({castawayName, method, eventType}); NULL means accepted exactly as proposed. Same audit-trail
  -- reasoning as wiki_proposal_items.applied.
  applied JSONB,
  decided_at TIMESTAMPTZ,
  decided_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT season_decisions_shape CHECK (
    (kind = 'elimination' AND method <> '' AND event_type = '') OR
    (kind = 'event'       AND method =  '' AND event_type <> '') OR
    (kind = 'exiled'      AND method =  '' AND event_type =  '')
  )
);

CREATE UNIQUE INDEX idx_season_decisions_identity
  ON season_decisions(season_id, episode_number, kind, castaway_name, event_type);
CREATE INDEX idx_season_decisions_status
  ON season_decisions(season_id, status, episode_number);

-- What each accepted decision actually did to each league's state. This is what makes applying
-- idempotent (a decision already in the ledger isn't applied twice, however often a league is
-- synced) and reversible (an admin rejecting or correcting an accepted row undoes exactly this, in
-- every league). `decided_at` snapshots the decision's own: when an admin re-decides a row, the
-- snapshot no longer matches and the next sync undoes the old application and applies the new one.
CREATE TABLE league_applied_decisions (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES season_decisions(id) ON DELETE CASCADE,
  decided_at TIMESTAMPTZ,
  -- {episodeNumber, castawayId, kind, eventType?, eventId?, preexisting?}. preexisting: the league
  -- already had this result (entered by hand, or from the old per-league review), so undoing the
  -- decision leaves it alone rather than removing something the admin's decision didn't add.
  detail JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, decision_id)
);
CREATE INDEX idx_league_applied_decisions_decision ON league_applied_decisions(decision_id);
