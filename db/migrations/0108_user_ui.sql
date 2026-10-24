-- Which design an account opens on (docs/PLAN-new-design.md step 0c): 'classic' (today's app) or 'new' (the new
-- design's routes, /home and the show space). Per account, so it follows you to every device; each device also
-- keeps a `gys_ui` cookie (src/lib/server/ui-choice.ts) so a signed-in "/" can go straight to /home without a
-- query (next.config.ts). Set from "Try the new design" in classic's menu and "Back to the classic design" in the
-- new design's settings. Step C drops it once everyone is on the new design.
ALTER TABLE user_settings ADD COLUMN ui TEXT NOT NULL DEFAULT 'classic' CHECK (ui IN ('classic', 'new'));
