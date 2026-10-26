-- Appearance (docs/PLAN-new-design.md step 15 part 4; the mock's settings.js accountRoute). Additive; classic reads none of it
-- (classic keeps its own Light / Dark / Match device per browser, src/lib/theme.ts).
--
-- The new design's theme, per account: 'night' (the default, as the new design has been until now), 'studio' (the light
-- theme, DESIGN.md's Studio) or 'phone' (whichever the phone is set to, following it as it changes). The account's choice is
-- the truth; the `gys_theme` cookie is each device's copy of it (src/lib/server/appearance.ts), so the page is drawn in it
-- before the first paint (src/lib/theme-script.ts).
--
-- Backed up with user_settings, like the account's other choices.
ALTER TABLE user_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'night' CHECK (theme IN ('night', 'studio', 'phone'));
