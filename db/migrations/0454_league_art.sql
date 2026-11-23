-- A league's art for you (docs/design-round/league-art-spec.md; the user, 2026-11-23: "Allow this to be set by user in settings"):
-- the art each league's band in Your shows and its page's bar wear for you, by league ({"football/nfl": "event-night-v1"}). A league
-- not in it wears its sport's first (src/lib/sports/league-art.ts). Only the app's own generated art, never a logo. Yours alone:
-- nobody else sees it.
ALTER TABLE user_settings ADD COLUMN league_art JSONB NOT NULL DEFAULT '{}'::jsonb;
