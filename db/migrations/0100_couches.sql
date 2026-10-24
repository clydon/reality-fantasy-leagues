-- Couches (docs/PLAN-new-design.md step 0b): the lasting group of people, across seasons and shows. A league
-- is one game in a couch. league_groups (0040) stays: it still links one season's leagues for one reveal and
-- one chat, and a couch can hold several groups and leagues over time.
--
-- Until the couch switches to the new design, the classic app keeps couches in step on its own
-- (src/lib/server/couches.ts): each linked group is one couch and each league outside a group is a couch of
-- its own, which is also how 0101 fills them in for the leagues that exist today.
CREATE TABLE couches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Everyone on a couch. Everyone in a league is on its couch; someone can be on a couch without playing any
-- of its games (the new design's Join a couch, step 9).
CREATE TABLE couch_members (
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (couch_id, user_id)
);
CREATE INDEX idx_couch_members_user ON couch_members(user_id);

-- Join a couch with a code (step 9 makes and shows them). expires_at NULL never expires.
CREATE TABLE couch_invites (
  code TEXT PRIMARY KEY,
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX idx_couch_invites_couch ON couch_invites(couch_id);

-- Which couch a league is a game in. No ON DELETE: a couch that still has games can't be deleted.
ALTER TABLE leagues ADD COLUMN couch_id UUID REFERENCES couches(id);
CREATE INDEX idx_leagues_couch ON leagues(couch_id);
