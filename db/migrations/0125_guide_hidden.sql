-- The TV guide's Hide from guide (docs/PLAN-new-design.md step 11 part 1; the mock's tvguide.js): a show that isn't on your
-- list (a couch show you don't follow, or, from part 2, a TV listing) can be hidden from your guide; "N hidden" under the
-- guide brings it back. Your own shows can't be hidden. Additive, and classic reads none of it.
--
-- A row is one person's hidden show: a show here (show_id, with its listing's id when it has one, so the same show in the
-- listings stays hidden too), or a listing nobody has made a show of yet (tvmaze_id only). `name` is what the "N hidden"
-- sheet lists, kept so a listing needs no lookup.
CREATE TABLE guide_hidden (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  tvmaze_id INTEGER,
  name TEXT NOT NULL,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (show_id IS NOT NULL OR tvmaze_id IS NOT NULL)
);
CREATE UNIQUE INDEX guide_hidden_show ON guide_hidden (user_id, show_id) WHERE show_id IS NOT NULL;
CREATE UNIQUE INDEX guide_hidden_listing ON guide_hidden (user_id, tvmaze_id) WHERE show_id IS NULL;
