-- A season's cast on the desk (docs/PLAN-desk-parity.md step 5, part 5a): the cast comes from our bot or a paste (no wiki,
-- decision 9), and an answer is staged, not written into the cast: the desk compares it with the cast (someone added, someone
-- it no longer lists, a new spelling of someone, a starting group it has differently) and nothing reaches the games until an
-- admin sends it. Classic's wiki pull upserted by name into season_cast at once (Noticed g).
--
--   season_cast_answers   one per answer: the season, where it came from ('bot': Ask our bot, through the Run now queue;
--                         'paste': Ask an AI and paste), the answer as given, the people it lists as the desk read them
--                         ([{ name, group, photo }]), who asked or pasted it and when, and when it was sent and by whom.
--                         Only a season's latest answer is reviewed; a sent one leaves the Inbox.
--
-- desk_runs (0424, not yet on production) takes a fifth kind, 'cast': Ask our bot queues behind the other Run nows (one
-- question at a time), as episode 0.
--
-- Additive: a new table, and a check widened on 0424's table.
CREATE TABLE season_cast_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('bot', 'paste')),
  answer TEXT NOT NULL,
  people JSONB NOT NULL,
  by_user TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  sent_by TEXT REFERENCES "user"(id) ON DELETE SET NULL
);
CREATE INDEX season_cast_answers_season ON season_cast_answers (season_id, created_at DESC);

ALTER TABLE desk_runs DROP CONSTRAINT desk_runs_kind_check;
ALTER TABLE desk_runs ADD CONSTRAINT desk_runs_kind_check CHECK (kind IN ('quick', 'full', 'schedule', 'trivia', 'bingo', 'cast'));
