-- League invites: any member can invite someone by username or email. The invitee may not have
-- an account yet, so `identifier` is stored as typed and matched case-insensitively against
-- "user".username/email at query time rather than resolved to a user_id up front.

CREATE TABLE league_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX idx_league_invites_league ON league_invites(league_id);
CREATE INDEX idx_league_invites_identifier ON league_invites(lower(identifier));
CREATE INDEX idx_league_invites_status ON league_invites(status);
-- Backstops the route's own "already a pending invite" check against two near-simultaneous sends.
CREATE UNIQUE INDEX uq_league_invites_pending ON league_invites(league_id, lower(identifier)) WHERE status = 'pending';
