-- A super admin's test couch (src/lib/server/test-couch.ts; docs/PLAN-researched-survivor.md): a couch's real games on a
-- season copied, every move and result as they are, onto other rules, played by test players the admin switches into from
-- the profile menu (classic's impersonation) to mimic what each real person does. Temporary tooling. Additive.
--
--   test_couches    one per super admin: the couch it is, where it was copied from (a couch and a season), the rules its games
--                   play by ('same' | 'template' | 'fresh' | 'researched'), a researched rulebook's answer (kept, so switching
--                   back to it needs no new ask), and a research running now (researching_at) or how the last one went.
--   test_players    the accounts made for it: one per real person in the copied games, each standing in for them (stands_for),
--                   in order (the admin's own stand-in first). They have no password: the only way in is the admin's switch.
--                   Gone with their account; the accounts go when the test couch is removed.
CREATE TABLE test_couches (
  couch_id UUID PRIMARY KEY REFERENCES couches(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  source_couch_id UUID REFERENCES couches(id) ON DELETE SET NULL,
  source_season_id UUID REFERENCES show_seasons(id) ON DELETE SET NULL,
  rules TEXT NOT NULL DEFAULT 'template' CHECK (rules IN ('same', 'template', 'fresh', 'researched')),
  rules_answer TEXT,
  researching_at TIMESTAMPTZ,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE test_players (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  couch_id UUID NOT NULL REFERENCES test_couches(couch_id) ON DELETE CASCADE,
  stands_for TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  position INTEGER NOT NULL
);
CREATE INDEX test_players_couch ON test_players (couch_id, position);
