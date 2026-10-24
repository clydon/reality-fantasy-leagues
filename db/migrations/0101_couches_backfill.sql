-- Fills in couches (0100) for every league that hasn't one: a linked group (0040) becomes one couch, named
-- after the group (or its show and season, as league-groups.ts's groupDisplayName does), and every league
-- outside a group becomes a couch of its own, named after the league. Everyone in a couch's leagues is on
-- the couch; its owner is whoever made it if they're on it, else its earliest commissioner, else its
-- earliest member.
--
-- Safe to run again: it only touches leagues without a couch, adds members who are missing, and picks an
-- owner only for a couch without one. tests/couch-backfill.test.js runs it inside a rolled-back transaction,
-- and scripts/restore-leagues.js runs it after restoring a backup taken before 0100.

-- 1. Linked groups. A group some of whose leagues already have a couch (one linked after couches existed)
--    brings the rest into that couch; a group with none gets a new one.
DROP TABLE IF EXISTS pg_temp.couch_for_group;
CREATE TEMP TABLE couch_for_group ON COMMIT DROP AS
SELECT g.id AS group_id, g.name, g.created_by,
       (SELECT l.couch_id FROM leagues l WHERE l.group_id = g.id AND l.couch_id IS NOT NULL
         ORDER BY l.group_position NULLS LAST, l.name, l.id LIMIT 1) AS couch_id,
       false AS is_new
  FROM league_groups g
 WHERE EXISTS (SELECT 1 FROM leagues l WHERE l.group_id = g.id AND l.couch_id IS NULL);

UPDATE couch_for_group SET couch_id = gen_random_uuid(), is_new = true WHERE couch_id IS NULL;

INSERT INTO couches (id, name, created_by, created_at)
SELECT c.couch_id,
       COALESCE(
         NULLIF(btrim(c.name), ''),
         (SELECT s.name || COALESCE(' ' || (l.state->'settings'->>'wikiSeason'), '')
            FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId'
           WHERE l.group_id = c.group_id
           ORDER BY l.group_position NULLS LAST, l.name, l.id LIMIT 1),
         'Linked leagues'),
       COALESCE(c.created_by,
         (SELECT l.created_by FROM leagues l WHERE l.group_id = c.group_id AND l.created_by IS NOT NULL
           ORDER BY l.group_position NULLS LAST, l.name, l.id LIMIT 1)),
       (SELECT min(l.created_at) FROM leagues l WHERE l.group_id = c.group_id)
  FROM couch_for_group c
 WHERE c.is_new;

UPDATE leagues l SET couch_id = c.couch_id
  FROM couch_for_group c
 WHERE l.group_id = c.group_id AND l.couch_id IS NULL;

-- 2. Every other league: a couch of its own.
DROP TABLE IF EXISTS pg_temp.couch_for_league;
CREATE TEMP TABLE couch_for_league ON COMMIT DROP AS
SELECT id AS league_id, gen_random_uuid() AS couch_id, name, created_by, created_at
  FROM leagues
 WHERE couch_id IS NULL;

INSERT INTO couches (id, name, created_by, created_at)
SELECT couch_id, name, created_by, created_at FROM couch_for_league;

UPDATE leagues l SET couch_id = c.couch_id FROM couch_for_league c WHERE l.id = c.league_id;

-- 3. Everyone in a couch's leagues is on the couch, from when they joined the first of them.
INSERT INTO couch_members (couch_id, user_id, role, joined_at)
SELECT l.couch_id, m.user_id, 'member', min(m.created_at)
  FROM league_memberships m JOIN leagues l ON l.id = m.league_id
 WHERE l.couch_id IS NOT NULL
 GROUP BY l.couch_id, m.user_id
ON CONFLICT (couch_id, user_id) DO NOTHING;

-- 4. An owner for every couch with members but none: its maker, else its earliest commissioner, else its
--    earliest member.
UPDATE couch_members cm SET role = 'owner'
  FROM (
    SELECT DISTINCT ON (c.id) c.id AS couch_id, m.user_id
      FROM couches c JOIN couch_members m ON m.couch_id = c.id
     WHERE NOT EXISTS (SELECT 1 FROM couch_members o WHERE o.couch_id = c.id AND o.role = 'owner')
     ORDER BY c.id,
              COALESCE(m.user_id = c.created_by, false) DESC,
              EXISTS (SELECT 1 FROM league_memberships lm JOIN leagues l ON l.id = lm.league_id
                       WHERE l.couch_id = c.id AND lm.user_id = m.user_id AND lm.role = 'commissioner') DESC,
              m.joined_at, m.user_id
  ) pick
 WHERE cm.couch_id = pick.couch_id AND cm.user_id = pick.user_id;
