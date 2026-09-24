-- Wiki connector proposals: what an extraction run wants to add to a league, awaiting commissioner
-- review. Nothing the connector produces is ever applied automatically -- see
-- docs/PLAN-league-types-and-wiki-connector.md, Feature D ("every extraction is a pending proposal").
--
-- Why a table rather than returning proposals straight to the client: the connector runs as a
-- standalone scheduled script (db/wiki-sync.js, Windows Task Scheduler locally), so nobody is
-- watching when it produces output. The proposal has to outlive the run and wait for whenever the
-- commissioner next opens the app.
--
-- `payload` holds the extracted, ALREADY-VALIDATED proposal (validated against the league's own
-- state, so it can't name a castaway or event type that doesn't exist -- see db/wiki-sync.js).
-- `provenance` records what it was derived from: source page titles, their wiki revision ids, the
-- model, and when. That exists because this extraction is LLM-based and therefore not reproducible
-- from the inputs alone -- without it, a commissioner reviewing a proposal a week later has no way
-- to tell what the model actually read.

CREATE TABLE wiki_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  -- 'cast' today; 'scoringEvents'/'eliminations' once Feature C's event log is wired in.
  kind TEXT NOT NULL CHECK (kind IN ('cast', 'scoringEvents', 'eliminations')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
  payload JSONB NOT NULL,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  -- Which account confirmed or rejected it. TEXT to match Better Auth's own id format, same as
  -- every other reference to "user"(id) in this schema.
  resolved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL
);

-- The review UI only ever asks for one league's pending proposals.
CREATE INDEX idx_wiki_proposals_league_status ON wiki_proposals(league_id, status);

-- At most one pending proposal per league per kind: a scheduled run that fires twice before anyone
-- reviews should replace its own earlier suggestion rather than stack up duplicates for the
-- commissioner to wade through. Enforced as a partial unique index so resolved rows accumulate
-- freely as history.
CREATE UNIQUE INDEX idx_wiki_proposals_one_pending
  ON wiki_proposals(league_id, kind)
  WHERE status = 'pending';
