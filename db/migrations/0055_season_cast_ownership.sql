-- One cast per season, written by whoever enters it first (docs/PLAN-universal-season-cast.md, pieces
-- 2 and 3). A season's cast used to come only from an admin (the wiki connector, then Approve); a
-- self-serve league typed its own roster into its own state, so two leagues on one season could each
-- have a differently spelled cast. Now the first league on a season to enter a cast creates the
-- SEASON's cast, every league on the season receives it, and once it's finished only an admin can
-- change it.
--
-- cast_created_by_league  the league whose commissioner created the cast (typing or "Import a cast").
--                         NULL for a cast an admin created -- admin-only from the start. While it's
--                         set and the cast isn't locked, that league's commissioner can keep editing.
-- cast_locked_at          when the creating league's editing ended: its commissioner pressed "Finish
--                         cast", or any league on the season got underway (a draft started, a pick or
--                         a lineup made), whichever came first (the plan's open question 1). Stamped
--                         lazily, the first time a write or a read notices.
-- cast_tribes_confirmed   whether whoever created the cast has said if the starting tribes were public
--                         before the premiere (tribes_from_episode NULL) or shown in an episode
--                         (tribes_from_episode = N, held until a league reaches it). A league-created
--                         cast starts unconfirmed with the tribes HELD from episode 1 -- the safe answer
--                         -- and the commissioner is asked. An admin's cast keeps the admin's own control.
ALTER TABLE show_seasons
  ADD COLUMN cast_created_by_league UUID REFERENCES leagues(id) ON DELETE SET NULL,
  ADD COLUMN cast_locked_at TIMESTAMPTZ,
  ADD COLUMN cast_tribes_confirmed BOOLEAN NOT NULL DEFAULT true;

-- Every change to a season's cast after it exists, by anyone, because every change reaches every
-- league on the season at once (the plan's risk: "log each change -- who, when, before/after").
--   field   'created' (the cast was created; after = how many people), 'added', 'removed', 'name',
--           'photo', 'tribe', 'tribes_hold'
--   by_league  the league a commissioner wrote it through; NULL for an admin's change in Admin.
CREATE TABLE season_cast_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  -- Not a foreign key: a 'removed' row outlives the person it describes.
  season_cast_id UUID,
  field TEXT NOT NULL,
  before TEXT,
  after TEXT,
  changed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  by_league UUID REFERENCES leagues(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX season_cast_changes_season_idx ON season_cast_changes (season_id, changed_at DESC);
