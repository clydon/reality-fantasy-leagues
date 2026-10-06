-- Show artwork (docs/PLAN-new-user-onboarding-flow.md phase 4): real tiles in the Create-League
-- wizard want an image instead of the per-format emoji fallback (SHOW_ICON in
-- create-league-wizard.tsx). Same free-text-URL pattern as a castaway's photoUrl (migration 0011) --
-- an admin pastes an external URL, or a path to a file dropped in public/show-art/ (same convention
-- as public/photos/ for cast), and src/lib/game/selectors.ts's path-resolving logic (generalised to
-- publicMediaSrc) turns either into a usable <img src>. Null means "show the emoji fallback".
ALTER TABLE shows ADD COLUMN art_url TEXT;
