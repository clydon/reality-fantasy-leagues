-- "How this league works" (docs/PLAN-league-explainer.md): shown once per membership, right after
-- joining. Null = not seen yet. Every membership that exists today has been playing already, and a
-- commissioner creating a league chose its type, so both default to seen; only joining (join-league.ts)
-- writes a null.
ALTER TABLE league_memberships ADD COLUMN explainer_seen_at TIMESTAMPTZ DEFAULT now();
