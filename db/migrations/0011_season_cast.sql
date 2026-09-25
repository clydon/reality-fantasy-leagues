-- The cast becomes SEASON data, approved once by an admin, instead of a per-league proposal every
-- commissioner has to approve for themselves.
--
-- Why it moved. A season's cast is a fact about the show, identical for every league playing it --
-- unlike an episode's results, which each league reviews against its own roster and scoring. The
-- old flow filed a `wiki_proposals` row per league and waited for each commissioner to press Apply,
-- which had two bad consequences: the admin who imports a season the moment they add it couldn't
-- finish the job (the cast sat unapplied in leagues they don't run), and a commissioner who pulled
-- cast and then episodes hit "no castaways in this league yet" while looking at a cast proposal
-- they had no reason to know was a separate step.
--
-- So: the connector stages what it extracted here, an admin reviews it (photos, names, tribes) in
-- Admin > Shows & Seasons, and approving it applies it to every league tracking the season, and to
-- any league that picks the season later. Episode results are untouched -- they stay per-league
-- decisions in wiki_proposal_items, because that's what they are.

CREATE TABLE season_cast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  -- As the wiki's cast table gives it. Matching to a league's own castaway is by name
  -- (Core.findCastawayByName), same as everywhere else the connector resolves a person.
  name TEXT NOT NULL,
  -- The starting tribe/faction/team, or NULL. Nullable and clearable on purpose: for a league
  -- catching up from episode 0, the starting tribe division is itself something the premiere
  -- reveals, so an admin can strip it before approving and leave the cast ungrouped.
  tribe_name TEXT,
  photo_url TEXT,
  -- The order the admin sees and leagues receive, so an approved cast isn't re-shuffled by a later
  -- re-pull. Set from the connector's spoiler-free ordering (tribe, then name) at staging time.
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per person per season. Case-insensitive, because a re-pull that spells a name with
-- different capitalisation is the same person, not a new one -- and a duplicate here would become a
-- duplicate castaway in every league.
CREATE UNIQUE INDEX season_cast_name_idx ON season_cast (season_id, lower(name));
CREATE INDEX season_cast_season_idx ON season_cast (season_id, sort_order);

-- NULL until an admin approves, and set back to NULL whenever a re-pull stages somebody new: a cast
-- that has changed since it was last looked at needs looking at again.
ALTER TABLE show_seasons ADD COLUMN cast_approved_at TIMESTAMPTZ;
ALTER TABLE show_seasons ADD COLUMN cast_approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
