-- Cast properties' dated facts (docs/PLAN-cast-properties.md chunks 6 and 6b), two kinds of season result beside a tribe move:
--   prop     a person's property changed this episode: event_type the property's key ("job"), method its new value ("Bosun").
--   holding  something a person got or let go of (an idol, an advantage): event_type "<twist id>:<how>:<its name, slugged>" (how:
--            found, won, given, bought, played, gave, expired, lost, stolen), method the other person in it ('' with none).
-- Accepted on the desk like any fact; applied per episode and spoiler-guarded as a tribe move is.
ALTER TABLE season_decisions DROP CONSTRAINT IF EXISTS season_decisions_kind_check;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_kind_check
  CHECK (kind = ANY (ARRAY['elimination', 'event', 'exiled', 'role', 'group', 'noexit', 'prop', 'holding']));
ALTER TABLE season_decisions DROP CONSTRAINT IF EXISTS season_decisions_shape;
ALTER TABLE season_decisions ADD CONSTRAINT season_decisions_shape CHECK (
  (kind = 'elimination' AND method <> '' AND event_type = '') OR
  (kind = 'event' AND method = '' AND event_type <> '') OR
  (kind = 'exiled' AND method = '' AND event_type = '') OR
  (kind = 'role' AND method <> '' AND event_type = '') OR
  (kind = 'group' AND event_type = '') OR
  (kind = 'noexit' AND castaway_name = '' AND method = '' AND event_type = '') OR
  (kind = 'prop' AND castaway_name <> '' AND method <> '' AND event_type <> '') OR
  (kind = 'holding' AND castaway_name <> '' AND event_type <> '')
);
