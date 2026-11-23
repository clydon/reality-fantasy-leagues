-- Solo (docs/PLAN-sports-couch.md C4; docs/design-round/solo-fan-spec.md): a game that's one person's own, on no couch, beside a
-- season's public pool and the retired practice couch (0120). A fan with no couch calls his team's games, calls the season and drafts
-- against computer players; each is an ordinary league with leagues.solo = 'own', so the couch-healing read (couches.ts healCouches,
-- solo IS NULL only) never wraps it in a made-up couch. No uniqueness: a fan may have several (his calls, a season call, a draft).
ALTER TABLE leagues DROP CONSTRAINT IF EXISTS leagues_solo_check;
ALTER TABLE leagues ADD CONSTRAINT leagues_solo_check CHECK (solo IN ('public', 'practice', 'own'));
