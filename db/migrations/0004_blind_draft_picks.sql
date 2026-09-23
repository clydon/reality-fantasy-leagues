-- Blind draft (shared-ownership Classic Draft): each player's submitted picks, held here until
-- every player has locked in and the draft reveals.
--
-- Why this is a table instead of a key inside leagues.state, which is where every other piece of
-- gameplay data lives: these picks must be hidden from other players until the simultaneous
-- reveal, and `state` is broadcast wholesale -- withLeagueLock returns it and every route does
-- NextResponse.json(state), so anything inside it is visible to any league member who opens their
-- Network tab. Redacting instead would mean every current and FUTURE state-returning route has to
-- remember to filter, failing open if one doesn't. Keeping the picks out of `state` entirely fails
-- closed: routes that serialize `state` cannot leak what was never in it, and reading these rows
-- takes a route that deliberately does so (see src/lib/server/blind-draft.ts, which enforces
-- self-only reads).
--
-- What IS public, and so does live in `state`: state.blindDraft.lockedPlayerIds (who has locked in,
-- for the "waiting on N players" UI) and state.blindDraft.revealedAt. Only the pick CONTENTS are
-- secret. `state.blindDraft.lockedPlayerIds` is a published mirror of this table's rows, rewritten
-- from it inside the same transaction on every lock/unlock -- this table stays the source of truth.
--
-- Rows are deleted at reveal: ownership has by then been written into
-- state.castaways[].ownerIds, which is the durable record, so keeping a second copy of the same
-- facts around here would only add a stale-data and privacy surface with nothing to gain.

CREATE TABLE blind_draft_picks (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  -- Matches an id inside leagues.state->'players' -- same convention (and same TEXT type) as
  -- league_memberships.player_id, not a foreign key, since players live in the JSONB blob.
  player_id TEXT NOT NULL,
  castaway_ids JSONB NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One submission per player per league; a row existing IS that player's lock.
  PRIMARY KEY (league_id, player_id)
);
