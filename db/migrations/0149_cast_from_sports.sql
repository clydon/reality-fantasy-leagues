-- A sport's cast from its linked games (docs/PLAN-sports-data.md step 3; src/lib/server/sports/cast.ts). Additive.
--
--   season_cast.provider_ids  each person's ids at the sports-data providers that know them ({"espn": "33481"}), so their stats
--                             (step 4: box scores, season lines) find them. NULL for everyone a provider didn't bring (Make it a game,
--                             the desk, our bot, a paste).
--   cast_fills.via            how the season's people were (or are being) filled in: 'sports' (the linked games' rosters), 'bot'
--                             (Fill in who's playing's ask), 'paste'. NULL for a fill before this.
ALTER TABLE season_cast ADD COLUMN provider_ids JSONB;
ALTER TABLE cast_fills ADD COLUMN via TEXT CHECK (via IN ('sports', 'bot', 'paste'));
