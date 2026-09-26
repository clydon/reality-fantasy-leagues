-- How many episodes a season has, when known. Without it the admin episode list and auto-research
-- counted weekly from the premiere date up to today, so a season that finished years ago "had" 60
-- episodes -- and a misread wiki pull could claim that many too. With it, everything is capped at the
-- real number: the episode list, auto-research, the research route, and wiki episode staging.
ALTER TABLE show_seasons
  ADD COLUMN episode_count int CHECK (episode_count > 0);
