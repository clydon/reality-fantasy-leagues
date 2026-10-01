-- Spoiler protection (StateLogic.SpoilerLogic): new episode results stay hidden from each member until
-- they tap "Results are in!". results_seen_through is the last episode whose results this member has
-- revealed; NULL until their first load of the league, which sets it to whatever already had results
-- then -- so turning this on hides nothing anyone has already seen, only what arrives from now on.
ALTER TABLE league_memberships ADD COLUMN results_seen_through INTEGER;

-- Account-level preferences that aren't notification types. show_results_immediately opts out of the
-- above: results appear as soon as they land, no Reveal step.
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  show_results_immediately BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
