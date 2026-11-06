-- Everyone on Night (the user, 2026-11-01: "force everyone on dark mode by default"). Night has been the new design's default
-- since 0138 (and what anyone signed out sees); every account that chose Studio or Match phone goes back to it. Settings ›
-- Appearance still offers both, and a choice made after this sticks; each device's cookie catches up on its next home read
-- (src/lib/server/appearance.ts). Classic's own per-browser choice defaults to dark from the same change (src/lib/theme.ts).
UPDATE user_settings SET theme = 'night', updated_at = now() WHERE theme <> 'night';
