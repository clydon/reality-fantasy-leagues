-- Tribe/team changes as season decisions: swaps, merges, new teams, weekly pairs, playing as
-- individuals (docs/PLAN-show-formats.md).
--
-- A change is a fact about an episode -- "Kyle moved to Beka in episode 7" -- decided once by an admin
-- and applied to leagues through the same reveal-gated sync as eliminations and roles, so a league
-- catching up sees a swap when it reaches that episode. The new group's name rides in `method`; an
-- empty method means "no group now" (playing as an individual), which is why this kind, unlike the
-- others that use method, allows it to be empty. One change per person per episode, which the
-- existing identity index (season, episode, kind, name, event_type) already enforces.
ALTER TABLE season_decisions DROP CONSTRAINT season_decisions_kind_check;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_kind_check
  CHECK (kind IN ('elimination', 'event', 'exiled', 'role', 'group'));

ALTER TABLE season_decisions DROP CONSTRAINT season_decisions_shape;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_shape CHECK (
  (kind = 'elimination' AND method <> '' AND event_type = '') OR
  (kind = 'event'       AND method =  '' AND event_type <> '') OR
  (kind = 'exiled'      AND method =  '' AND event_type =  '') OR
  (kind = 'role'        AND method <> '' AND event_type =  '') OR
  (kind = 'group'                         AND event_type =  '')
);
