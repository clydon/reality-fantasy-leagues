-- Waivers v2 (docs/PLAN-waivers-v2.md): one claim type ("add X, drop Y", ranked), replacement rules,
-- waiver windows. Every league keeps doing exactly what it does today.
--
-- 1. waiver_claims gets `pairs`: ranked [{ addId, dropId }]. Saved claims are backfilled from the old
--    columns the way WaiverLogic.pairsOf reads them: each pickup paired with every loss it could replace
--    (oldest first, so processing takes them in the old order), then the add/drop's adds with its drop.
--    The old columns stay (the server keeps writing them) and are dropped a release later. A row the old
--    code saves during the deploy is converted on read (src/lib/server/waivers.js rowToClaim).
--
-- 2. Each league's settings get the v2 keys, from what its old switches meant (WaiverLogic.legacyConfig,
--    which migrateLeagueState also runs):
--      replenishEnabled off -> replaceRule 'never'; on -> 'whenShort' (Active Roster, its replenishAt
--        unchanged) or 'always' (Classic)
--      tradeEnabled on -> waiverWindows { schedule: 'every' ('everyEpisode' if swapEvery is 1),
--        every: swapEvery, swaps: 1 }; off -> { schedule: 'manual', every: swapEvery, swaps: 0 }
--        (0, not the plan's 1, so a league with both switches off stays off: see WaiverLogic.enabled)
--      waiverFeel 'balanced', autoFill true
--    The old keys stay, kept in step (WaiverLogic.mirrorLegacy), for one release.
--
-- 3. Each waiver week gets `window` (= its addDrop) and `swaps` (1 on an add/drop week, else 0).
--
-- Guarded per row (only what lacks the new keys), so it's safe however it meets a league.

ALTER TABLE waiver_claims ADD COLUMN pairs JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE waiver_claims w SET pairs = COALESCE((
  SELECT jsonb_agg(x.pair ORDER BY x.ord)
  FROM (
    SELECT jsonb_build_object('addId', pk.v, 'dropId', l.id) AS pair, pk.i * 1000 + l.rn AS ord
    FROM jsonb_array_elements_text(w.pickup_ids) WITH ORDINALITY AS pk(v, i)
    CROSS JOIN (
      SELECT c->>'id' AS id,
             row_number() OVER (ORDER BY COALESCE((c->>'placementOrder')::numeric, 0), co) AS rn
      FROM leagues lg, jsonb_array_elements(lg.state->'castaways') WITH ORDINALITY AS t(c, co)
      WHERE lg.id = w.league_id
        AND c->>'status' = 'eliminated'
        AND COALESCE(c->'ownerIds', '[]'::jsonb) ? w.player_id
        AND COALESCE(c->>'replenishClaimed', 'false') <> 'true'
    ) l
    UNION ALL
    SELECT jsonb_build_object('addId', a.v, 'dropId', w.drop_id), 1000000 + a.i
    FROM jsonb_array_elements_text(w.add_ids) WITH ORDINALITY AS a(v, i)
    WHERE w.drop_id IS NOT NULL
  ) x
), '[]'::jsonb)
WHERE w.pairs = '[]'::jsonb;

UPDATE leagues lg SET state = jsonb_set(lg.state, '{settings}', (lg.state->'settings') || jsonb_build_object(
  'replaceRule', CASE
    WHEN v.replenish THEN CASE WHEN lg.state->'settings'->>'leagueTypeId' = 'active-roster' THEN 'whenShort' ELSE 'always' END
    ELSE 'never' END,
  'waiverWindows', jsonb_build_object(
    'schedule', CASE WHEN NOT v.trade THEN 'manual' WHEN v.swap_every = 1 THEN 'everyEpisode' ELSE 'every' END,
    'every', GREATEST(2, v.swap_every),
    'swaps', CASE WHEN v.trade THEN 1 ELSE 0 END),
  'waiverFeel', COALESCE(lg.state->'settings'->'waiverFeel', '"balanced"'::jsonb),
  'autoFill', COALESCE(lg.state->'settings'->'autoFill', 'true'::jsonb)
))
FROM (
  SELECT id,
         state->'settings'->>'replenishEnabled' = 'true' AS replenish,
         state->'settings'->>'tradeEnabled' = 'true' AS trade,
         -- MidSeasonLogic.swapEvery: a whole number of 1 or more, else 3.
         CASE WHEN jsonb_typeof(state->'settings'->'swapEvery') = 'number'
                   AND (state->'settings'->>'swapEvery')::numeric >= 1
                   AND (state->'settings'->>'swapEvery')::numeric = floor((state->'settings'->>'swapEvery')::numeric)
              THEN (state->'settings'->>'swapEvery')::int ELSE 3 END AS swap_every
  FROM leagues
) v
WHERE v.id = lg.id
  AND lg.state ? 'settings'
  AND NOT (lg.state->'settings' ? 'replaceRule');

UPDATE leagues SET state = jsonb_set(state, '{midSeason,waivers,periods}', (
  SELECT jsonb_agg(
    CASE WHEN p ? 'window' THEN p
         ELSE p || jsonb_build_object(
           'window', COALESCE(p->>'addDrop', 'false') = 'true',
           'swaps', CASE WHEN COALESCE(p->>'addDrop', 'false') = 'true' THEN 1 ELSE 0 END)
    END ORDER BY ord)
  FROM jsonb_array_elements(state->'midSeason'->'waivers'->'periods') WITH ORDINALITY AS t(p, ord)
))
WHERE jsonb_typeof(state->'midSeason'->'waivers'->'periods') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(state->'midSeason'->'waivers'->'periods') p WHERE NOT p ? 'window'
  );
