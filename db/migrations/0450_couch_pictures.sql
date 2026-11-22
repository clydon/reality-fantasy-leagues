-- A couch's own pictures (docs/PLAN-team-logos.md L4): a picture someone on the couch set for a team, shown only to that couch's
-- members in place of our badge for the team. The app never supplies one (no gallery, no suggestion): a member sets it, or the
-- site's owner loads one into their own couch by hand (scripts/couch-team-pictures.js). Each is a finished 256 by 256 square
-- (the logo on the white plate, the team's colour on its cut corner: the plan's "Composition"), a few KB to ~40 KB.
--
-- key: what it's a picture of. "team:<league>:<team id>" (as the sports provider names them: team:football/nfl:12) for now; a
-- player's own fantasy team ("seat:<league id>:<player key>") comes with the upload screens.
-- set_by: the account that set it (never shown beyond the couch). source: 'upload' (a member, through the app) or 'load' (the
-- owner's one-off script). Not backed up, like faces (user_pictures): whoever set it can set it again.
CREATE TABLE couch_pictures (
  couch_id UUID NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (length(key) <= 120),
  picture BYTEA NOT NULL CHECK (octet_length(picture) <= 102400),
  type TEXT NOT NULL CHECK (type IN ('image/webp', 'image/png', 'image/jpeg')),
  version INTEGER NOT NULL DEFAULT 1,
  set_by TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'load')),
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (couch_id, key)
);
