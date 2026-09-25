-- The per-league, per-decision review queue for db/episode-research.js -- the same JOB as
-- wiki_proposal_items (0009), deliberately a SEPARATE table rather than a widened one.
--
-- wiki_proposal_items' shape is built around a source with two-valued confidence and three
-- mutually exclusive kinds, enforced by wiki_proposal_items_shape. Research doesn't fit that shape
-- without weakening it: confidence is three-valued (unknown is a real, distinct answer -- see
-- 0014's comment), every claim carries its own sources (a search has no revision id to point at
-- instead), and it produces event types the wiki structurally cannot (idol finds, votes received,
-- sit-outs) alongside ones the wiki already produces. Loosening wiki_proposal_items' CHECK to admit
-- all of that would blur the very distinction the two connectors are kept separate to preserve: one
-- source is reproducible and needs no sourcing, the other isn't and does.
--
-- Everything ELSE about how this behaves matches 0009 on purpose -- same pending/accepted/rejected
-- lifecycle, same "decided rows are permanent, re-running only touches what's still pending" rule,
-- same "resolve the name to a castaway at ACCEPT time, not at file time" (a proposal can sit pending
-- while the league's cast changes; a stale name simply fails to resolve and gets reported, same as
-- baking in a stale id would not). That symmetry is deliberate: a commissioner reviewing an episode
-- should recognize the shape immediately, whichever connector produced the row.
CREATE TABLE episode_research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  -- Which research row produced this, for per-item provenance in the review UI. CASCADE for the same
  -- reason as wiki_proposal_items.extraction_id: an item whose source research is gone has no story
  -- left to tell about where it came from.
  research_id UUID NOT NULL REFERENCES episode_research(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  -- 'event' scores through ActiveRosterLogic.addEvent + settings.eventPoints, same pipeline the wiki
  -- connector already feeds. 'exiled' is the same fact-only record exile already is everywhere else
  -- in this app (EpisodeLogic.addExiled) -- scores nothing, by the same design as the wiki path's.
  kind TEXT NOT NULL CHECK (kind IN ('event', 'exiled')),
  castaway_name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '',  -- 'event' only, an ACTIVE_ROSTER_EVENTS id
  CONSTRAINT episode_research_items_shape CHECK (
    (kind = 'event'  AND event_type <> '') OR
    (kind = 'exiled' AND event_type =  '')
  ),
  -- Three-valued, unlike wiki_proposal_items' two: 'high' the model stated it plainly, 'medium' it
  -- was implied, 'low' pieced together or from a single weak source. Carried straight off the
  -- checklist entry (db/episode-research.js's CastawayChecklist.confidence) rather than collapsed,
  -- because collapsing is exactly what turns "the sources disagree" into "trust this like any other".
  confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  -- URLs behind THIS claim. A wiki item has none because a revision id already pins its source; a
  -- research item's whole claim to trust rests on these, so a reviewer can check them without
  -- leaving the page. Empty only if research itself couldn't establish anything for this claim,
  -- which validateResearch already refuses to let happen for a 'yes' answer.
  sources TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  -- What was ACTUALLY committed, when the commissioner corrected the item before accepting it --
  -- same audit-trail reasoning as wiki_proposal_items.applied.
  applied JSONB,
  decided_at TIMESTAMPTZ,
  decided_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_items_league_episode
  ON episode_research_items(league_id, episode_number, status);

-- One row per decision, forever -- not one per pending decision. Same reasoning as
-- idx_wiki_items_identity (0009): re-researching an episode should update its own still-pending
-- items, never duplicate them, and must never resurrect a decision the commissioner already made by
-- inserting a fresh pending copy of the exact thing they rejected. event_type is part of the
-- identity because one person can genuinely earn two different event types in the same episode.
CREATE UNIQUE INDEX idx_research_items_identity
  ON episode_research_items(league_id, episode_number, castaway_name, kind, event_type);
