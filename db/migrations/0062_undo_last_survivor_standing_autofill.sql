-- One-time data fix: undoes the two auto-filled pickups conor (p_ms6xvk3) got in "Last Survivor
-- Standing" (9270fe9b-...) when its episode-3 waiver week (wv_0sswrls) processed and closed in the
-- same instant -- the bug 8f85285 fixed (no free agency, so nothing should have been auto-filled;
-- what's owed carries over to the next week's claims instead).
--
--   tx_2wzgysx  Sharonda Cox (c_88nfy88) in for Patt Cannaday (c_4p4bn6m)
--   tx_6xy1igb  Lewis Kelly  (c_bsuv3vx) in for Jenna Doore    (c_4k15i0n)
--
-- Exactly what MidSeasonLogic.revert does with each entry's `prev`: Patt and Jenna go back on conor's
-- team (still eliminated, not yet replaced), Sharonda and Lewis lose conor and their acquiredVia, both
-- entries leave midSeason.log and the week's autoFills. Conor then owes those two pickups in the
-- episode-4 week that's open now. Guarded on both entries still being in the log, so it's a no-op
-- anywhere else (a fresh dev DB, or if it was already fixed by hand).
DO $$
DECLARE
  lid uuid := '9270fe9b-fddb-4d3e-9119-f5331326307f';
  me text := 'p_ms6xvk3';
  s jsonb;
BEGIN
  SELECT state INTO s FROM leagues WHERE id = lid FOR UPDATE;
  IF s IS NULL OR (
    SELECT count(*) FROM jsonb_array_elements(s->'midSeason'->'log') tx
    WHERE tx->>'id' IN ('tx_2wzgysx', 'tx_6xy1igb') AND tx->>'via' = 'auto'
  ) <> 2 THEN
    RETURN;
  END IF;

  s := jsonb_set(s, '{castaways}', (
    SELECT jsonb_agg(
      CASE
        -- The losses: conor owns them again, and they're no longer marked replaced.
        WHEN c->>'id' IN ('c_4p4bn6m', 'c_4k15i0n') THEN
          c || jsonb_build_object(
            'ownerIds', CASE WHEN COALESCE(c->'ownerIds', '[]') ? me THEN COALESCE(c->'ownerIds', '[]')
                             ELSE COALESCE(c->'ownerIds', '[]') || to_jsonb(me) END,
            'replenishClaimed', false, 'formerOwnerId', null, 'departedVia', null)
        -- The auto-picks: back to free agents (anyone else's ownership untouched).
        WHEN c->>'id' IN ('c_88nfy88', 'c_bsuv3vx') THEN
          c || jsonb_build_object(
            'ownerIds', COALESCE((SELECT jsonb_agg(o) FROM jsonb_array_elements(c->'ownerIds') o WHERE o <> to_jsonb(me)), '[]'),
            'acquiredVia', null)
        ELSE c
      END ORDER BY ord)
    FROM jsonb_array_elements(s->'castaways') WITH ORDINALITY AS t(c, ord)
  ));

  s := jsonb_set(s, '{midSeason,log}', COALESCE((
    SELECT jsonb_agg(tx ORDER BY ord)
    FROM jsonb_array_elements(s->'midSeason'->'log') WITH ORDINALITY AS t(tx, ord)
    WHERE tx->>'id' NOT IN ('tx_2wzgysx', 'tx_6xy1igb')
  ), '[]'));

  s := jsonb_set(s, '{midSeason,waivers,periods}', (
    SELECT jsonb_agg(CASE WHEN p->>'id' = 'wv_0sswrls' THEN p || '{"autoFills": []}' ELSE p END ORDER BY ord)
    FROM jsonb_array_elements(s->'midSeason'->'waivers'->'periods') WITH ORDINALITY AS t(p, ord)
  ));

  UPDATE leagues SET state = s WHERE id = lid;
END $$;
