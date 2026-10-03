-- Linked leagues (0040) get an order and a favorite, both set by a commissioner in League Settings >
-- Linked leagues:
--   * leagues.group_position -- where this league sits in its group: the swipe order, the dots under
--     the league name, and the league switcher's order for the group. NULL (every league linked
--     before this, and any unlinked one) sorts after the numbered ones, by name.
--   * league_groups.favorite_league_id -- the league the app opens on for anyone in the group. NULL
--     is no favorite: the app opens wherever it was last left, as before.
ALTER TABLE leagues ADD COLUMN group_position INT;
ALTER TABLE league_groups ADD COLUMN favorite_league_id UUID REFERENCES leagues(id) ON DELETE SET NULL;

-- Leagues already linked keep the order they had (by name), now written down.
UPDATE leagues l SET group_position = o.pos
  FROM (SELECT id, row_number() OVER (PARTITION BY group_id ORDER BY name, id) - 1 AS pos
          FROM leagues WHERE group_id IS NOT NULL) o
 WHERE l.id = o.id;
