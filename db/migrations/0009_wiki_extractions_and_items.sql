-- Wiki connector, second shape: extract once per SEASON, review once per DECISION.
--
-- What was wrong with the first shape (0005's wiki_proposals):
--
--   1. Extraction was per-league. Ten leagues drafting Survivor 51 meant ten identical LLM reads of
--      the same wiki page -- the page doesn't differ by league, so nine of those were waste.
--   2. Review was per-PAYLOAD. One proposal carried every elimination and every scoring event across
--      every episode, applied all-or-nothing. A single wrong row (see the season 51 episode 1
--      misread that motivated this) meant rejecting the whole season's worth of correct ones, or
--      applying the lot and hand-fixing afterwards.
--
-- So this splits the old single concept in two:
--
--   wiki_extractions    -- what the model read, once per (show, season). Shared by every league.
--   wiki_proposal_items -- one reviewable decision, per league. Fanned out from an extraction.
--
-- wiki_proposals SURVIVES, for kind='cast' only. A season's cast list is a one-time whole-roster
-- import with no per-episode axis to split on, so "accept this list" is still the right question to
-- ask about it. Its 'eliminations'/'scoringEvents' kinds are superseded by wiki_proposal_items and
-- stop being written; no attempt is made to convert existing pending rows of those kinds, since the
-- feature has no production users yet (apply or reject any stragglers in a dev DB first, or leave
-- them -- nothing reads them once the review UI stops rendering those two kinds).

-- ---------------------------------------------------------------------------------------------
-- The shared, per-season cache.
--
-- `payload` is the RAW model output (CastSchema/EpisodesSchema shape in db/wiki-sync.js), captured
-- BEFORE validateCast/validateEpisodes run. That boundary is the whole point: those two functions
-- resolve wiki names against one league's own castaways, so their output is league-specific and
-- can't be shared -- but everything upstream of them (fetch the page, ask the model what it says)
-- is identical for every league tracking that season. Caching at exactly this line is what turns N
-- model calls into one.
--
-- `kind` here is the EXTRACTOR that produced it ('cast'/'episodes'), not wiki_proposals.kind --
-- one 'episodes' extraction fans out into elimination, event AND exiled items downstream.
--
-- show_id is a real FK here, unlike leagues (which reference shows by slug, see 0006's comment on
-- why). A cached extraction is derived data with no independent value: if the show row goes, its
-- cache should go with it, and can simply be re-extracted if the show comes back.
CREATE TABLE wiki_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cast', 'episodes')),
  payload JSONB NOT NULL,
  -- Source pages + their wiki revision ids, model, timestamp -- same shape and same reason as
  -- wiki_proposals.provenance (0005): LLM extraction isn't reproducible from its inputs, so what it
  -- actually read has to travel with the result. Now it travels to every league that shares it.
  provenance JSONB NOT NULL,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One cached extraction per season per extractor. A re-run replaces it (the wiki is the moving
-- part; the newest read wins), which is also what makes "has this season been read yet?" a single
-- indexed lookup for the batch job.
CREATE UNIQUE INDEX idx_wiki_extractions_key
  ON wiki_extractions(show_id, season_number, kind);

-- ---------------------------------------------------------------------------------------------
-- One decision, for one league, about one person, in one episode.
--
-- This is the unit the commissioner actually reviews, in the Episodes tab's per-episode "Reveal
-- Outcome" panel: accept it, reject it, or correct it and then accept. Three kinds:
--
--   elimination -- someone left the game. Applied via EpisodeLogic.addElimination.
--   event       -- a scoring event (immunity, idol played, ...). Applied via ActiveRosterLogic.addEvent.
--   exiled      -- sent to an Exile Island-style twist: away from their tribe, still in the game.
--                  Applied via EpisodeLogic.addExiled, which records the fact and scores NOTHING.
--                  Exile is new enough this season that what it should be WORTH is an open question,
--                  and guessing at that in the connector would bake a scoring decision into an
--                  extraction tool. Recording it now means scoring can be layered on later without
--                  re-reading a single wiki page.
--
-- castaway_name, not castaway_id, deliberately -- same reasoning as wiki_proposals' payload (0005):
-- an item can sit pending while the league's cast changes, and a stale id would apply silently
-- wrong where a stale name simply fails to resolve and gets reported. Resolution happens at accept
-- time, through Core.findCastawayByName.
CREATE TABLE wiki_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  -- Which read produced this, for per-item provenance in the review UI ("what did the model
  -- actually look at?"). CASCADE because an item whose source extraction is gone has no story to
  -- tell about where it came from.
  extraction_id UUID NOT NULL REFERENCES wiki_extractions(id) ON DELETE CASCADE,
  -- By NUMBER, not episode id: the episode may not exist in this league yet (the accept path
  -- creates it via EpisodeLogic.ensureEpisodeNumber), and numbers are what the wiki gives us.
  episode_number INTEGER NOT NULL,
  -- Carried alongside the number so the accept path can create the episode correctly if it doesn't
  -- exist yet (EpisodeLogic.ensureEpisodeNumber needs it up front -- it only matters at creation
  -- time, but there's no way to know in advance which item will be the one to create the episode).
  post_merge BOOLEAN NOT NULL DEFAULT false,
  kind TEXT NOT NULL CHECK (kind IN ('elimination', 'event', 'exiled')),
  castaway_name TEXT NOT NULL,
  -- '' rather than NULL for the not-applicable-to-this-kind case, so the identity index below
  -- behaves: Postgres treats NULL as distinct from itself in a unique index, which would let
  -- duplicate eliminations for one person slip past it. '' has no such problem.
  method TEXT NOT NULL DEFAULT '',        -- elimination only, an EXIT_METHODS value
  event_type TEXT NOT NULL DEFAULT '',    -- event only, an EVENT_TYPES value
  -- event only. 'low' means the model inferred it (footnote markers, counted votes) rather than
  -- reading it outright -- surfaced in the review UI so those get a harder look. Eliminations and
  -- exiles come off a stated column, so they're always 'high'.
  confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  -- What was ACTUALLY committed, when the commissioner corrected the extraction before accepting
  -- it ({castawayName, method} / {castawayName, eventType}). NULL means "accepted exactly as
  -- extracted", which is the common case. Without this, an edited-then-accepted item would read
  -- back as though the model got it right -- a quietly dishonest audit trail for a feature whose
  -- entire premise is that the model sometimes doesn't.
  applied JSONB,
  decided_at TIMESTAMPTZ,
  -- TEXT to match Better Auth's own id format, same as every other "user"(id) reference here.
  decided_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Each kind carries exactly the fields it means, and none of the others. Cheap to enforce here,
  -- and it makes a whole class of fan-out bug (an 'exiled' row that somehow has a method, an
  -- 'event' row with no type) structurally impossible rather than merely unlikely.
  CONSTRAINT wiki_proposal_items_shape CHECK (
    (kind = 'elimination' AND method <> '' AND event_type = '') OR
    (kind = 'event'       AND method =  '' AND event_type <> '') OR
    (kind = 'exiled'      AND method =  '' AND event_type =  '')
  )
);

-- The review UI asks for one league's pending items and groups them by episode.
CREATE INDEX idx_wiki_items_league_episode
  ON wiki_proposal_items(league_id, episode_number, status);

-- One row per decision, FOREVER -- not one per pending decision.
--
-- The identity of a decision is "which fact, about whom, in which episode": method is the value
-- being proposed, not part of what makes it the same decision, so the model changing its mind about
-- Voted Out vs Medically Evacuated updates the row rather than adding a rival one. event_type IS
-- part of the identity, because one person genuinely can earn both an immunity and an idol play in
-- the same episode -- two separate decisions about the same person.
--
-- Note this deliberately covers every status, not just pending. A partial index (WHERE
-- status='pending') would leave rejected rows invisible to ON CONFLICT, so the nightly re-run would
-- insert a fresh pending copy of the exact item the commissioner just rejected, every single night,
-- forever. Covering all statuses makes the row itself the permanent record of the decision, and the
-- fan-out's DO UPDATE carries its own `WHERE status='pending'` so a decided row is never disturbed.
--
-- The tradeoff: if the wiki is later corrected such that a rejected item becomes right, it stays
-- rejected and won't resurface on its own. That's the correct default -- a commissioner's decision
-- shouldn't be quietly overturned by a scheduled job -- and the item is still there to be revisited
-- by hand.
CREATE UNIQUE INDEX idx_wiki_items_identity
  ON wiki_proposal_items(league_id, episode_number, kind, castaway_name, event_type);
