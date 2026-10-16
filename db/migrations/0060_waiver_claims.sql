-- Mid-season waivers (docs/PLAN-midseason-waivers.md): each player's private claims for a waiver
-- week, held here until the week closes.
--
-- A table rather than a key in leagues.state for the same reason as blind_draft_picks (0004): `state`
-- is returned wholesale by GET .../state and by every mutation route, so anything inside it is readable
-- from any member's Network tab. Claims are private -- from other players and from the commissioner --
-- until they process, so they never enter `state`, and only src/lib/server/waivers.js reads them.
--
-- What IS public lives in `state`: the week itself (state.midSeason.waivers.periods[]), its `claimsIn`
-- (who has a claim saved, a mirror of this table's rows rewritten inside the same transaction on every
-- save), and once processed, every outcome and why.
--
-- Rows are deleted when the week closes (the next episode airs). They're kept through free agency so
-- the commissioner's Undo last waiver run can reopen claims as they were.

CREATE TABLE waiver_claims (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  -- state.midSeason.waivers.periods[].id; not a foreign key, since periods live in the JSONB blob.
  period_id TEXT NOT NULL,
  -- An id inside leagues.state->'players', as league_memberships.player_id.
  player_id TEXT NOT NULL,
  -- Ranked castaway ids (first = first choice).
  pickup_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  drop_id TEXT,
  add_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Who saved it: the player, or the commissioner claiming for them.
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, period_id, player_id)
);
