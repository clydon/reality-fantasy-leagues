-- Secret roles as season decisions (The Traitors; docs/PLAN-show-formats.md).
--
-- A role is a fact about an episode -- "Katie became a Traitor in episode 3" -- decided once by an
-- admin like an elimination, and applied to leagues through the same reveal-gated sync, so a league
-- catching up doesn't learn who the Traitors are before it reaches the episode that showed it.
--
-- The role value ('Traitor', 'Recruited Traitor') rides in `method`, the column that already means
-- "what kind of result this was" for an elimination; the format's roles.values is the list of valid
-- ones, checked by the admin API. One role per person per episode, which the existing identity index
-- (season, episode, kind, name, event_type) already enforces.
ALTER TABLE season_decisions DROP CONSTRAINT season_decisions_kind_check;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_kind_check
  CHECK (kind IN ('elimination', 'event', 'exiled', 'role'));

ALTER TABLE season_decisions DROP CONSTRAINT season_decisions_shape;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_shape CHECK (
  (kind = 'elimination' AND method <> '' AND event_type = '') OR
  (kind = 'event'       AND method =  '' AND event_type <> '') OR
  (kind = 'exiled'      AND method =  '' AND event_type =  '') OR
  (kind = 'role'        AND method <> '' AND event_type =  '')
);
