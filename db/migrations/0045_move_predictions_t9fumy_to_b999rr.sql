-- One-off: moves the episode predictions (side bets) from league T9FUMY into league B999RR -- every
-- bet with its wording, points and guesses, and how each guess was scored -- along with the
-- predictions setting (settings.bonusEnabled, which StandingsLogic needs on for any of them to count,
-- and settings.defaultBetPoints). The source league's bets are removed, so they live in one place.
--
-- The two leagues have the same people but their own player ids, so ids are translated: first by
-- account (the same user's league_memberships seat in each), then by player name for a seat with no
-- account behind it (a computer player). Episodes are matched by number. Anything that can't be
-- matched -- a player or an episode missing from B999RR -- fails the migration (and so the build)
-- rather than dropping a prediction quietly.
--
-- A no-op wherever either league doesn't exist (a dev database, a fresh clone). Bets already in
-- B999RR are kept; one with the same id as a moved bet isn't duplicated.

DO $$
DECLARE
  src_id UUID;
  tgt_id UUID;
  src_state JSONB;
  tgt_state JSONB;
  pmap JSONB := '{}'::jsonb;
  unmapped TEXT;
  ep JSONB;
  bet JSONB;
  tgt_idx INT;
  new_bets JSONB;
  moved_bets INT := 0;
  moved_preds INT := 0;
BEGIN
  SELECT id, state INTO src_id, src_state FROM leagues WHERE join_code = 'T9FUMY' FOR UPDATE;
  SELECT id, state INTO tgt_id, tgt_state FROM leagues WHERE join_code = 'B999RR' FOR UPDATE;
  IF src_id IS NULL OR tgt_id IS NULL THEN
    RAISE NOTICE '0045: league T9FUMY or B999RR not found -- nothing to move';
    RETURN;
  END IF;

  -- Source player id -> target player id: same account first, then same name.
  SELECT COALESCE(jsonb_object_agg(sp->>'id', COALESCE(by_user.player_id, by_name.id)), '{}'::jsonb)
    INTO pmap
    FROM jsonb_array_elements(src_state->'players') sp
    LEFT JOIN LATERAL (
      SELECT tm.player_id
        FROM league_memberships sm
        JOIN league_memberships tm ON tm.user_id = sm.user_id AND tm.league_id = tgt_id
       WHERE sm.league_id = src_id AND sm.player_id = sp->>'id'
    ) by_user ON true
    LEFT JOIN LATERAL (
      SELECT tp->>'id' AS id
        FROM jsonb_array_elements(tgt_state->'players') tp
       WHERE lower(btrim(tp->>'name')) = lower(btrim(sp->>'name'))
       LIMIT 1
    ) by_name ON true
   WHERE COALESCE(by_user.player_id, by_name.id) IS NOT NULL;

  -- Every player who guessed or proposed a bet must have a seat in the target.
  SELECT string_agg(DISTINCT pid, ', ') INTO unmapped
    FROM (
      SELECT p->>'playerId' AS pid
        FROM jsonb_array_elements(src_state->'episodes') e,
             jsonb_array_elements(COALESCE(e->'bets', '[]'::jsonb)) b,
             jsonb_array_elements(COALESCE(b->'predictions', '[]'::jsonb)) p
      UNION
      SELECT b->>'createdByPlayerId'
        FROM jsonb_array_elements(src_state->'episodes') e,
             jsonb_array_elements(COALESCE(e->'bets', '[]'::jsonb)) b
       WHERE b->>'createdByPlayerId' IS NOT NULL
    ) ids
   WHERE NOT pmap ? pid;
  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION '0045: no matching player in B999RR for source player(s) %', unmapped;
  END IF;

  FOR ep IN SELECT e FROM jsonb_array_elements(src_state->'episodes') e
             WHERE jsonb_array_length(COALESCE(e->'bets', '[]'::jsonb)) > 0
  LOOP
    SELECT o - 1 INTO tgt_idx
      FROM jsonb_array_elements(tgt_state->'episodes') WITH ORDINALITY t(te, o)
     WHERE (te->>'number')::int = (ep->>'number')::int
     LIMIT 1;
    IF tgt_idx IS NULL THEN
      RAISE EXCEPTION '0045: B999RR has no episode %, which has predictions in T9FUMY', ep->>'number';
    END IF;

    new_bets := COALESCE(tgt_state->'episodes'->tgt_idx->'bets', '[]'::jsonb);
    FOR bet IN SELECT b FROM jsonb_array_elements(ep->'bets') b LOOP
      CONTINUE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(new_bets) x WHERE x->>'id' = bet->>'id');
      bet := jsonb_set(bet, '{predictions}', (
        SELECT COALESCE(jsonb_agg(jsonb_set(p, '{playerId}', pmap->(p->>'playerId')) ORDER BY o), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(bet->'predictions', '[]'::jsonb)) WITH ORDINALITY q(p, o)));
      IF bet->>'createdByPlayerId' IS NOT NULL THEN
        bet := jsonb_set(bet, '{createdByPlayerId}', pmap->(bet->>'createdByPlayerId'));
      END IF;
      new_bets := new_bets || jsonb_build_array(bet);
      moved_bets := moved_bets + 1;
      moved_preds := moved_preds + jsonb_array_length(bet->'predictions');
    END LOOP;
    tgt_state := jsonb_set(tgt_state, ARRAY['episodes', tgt_idx::text, 'bets'], new_bets);
  END LOOP;

  -- The predictions setting comes across with them.
  tgt_state := jsonb_set(tgt_state, '{settings,bonusEnabled}', COALESCE(src_state->'settings'->'bonusEnabled', 'false'::jsonb));
  IF src_state->'settings' ? 'defaultBetPoints' THEN
    tgt_state := jsonb_set(tgt_state, '{settings,defaultBetPoints}', src_state->'settings'->'defaultBetPoints');
  END IF;

  -- Moved, not copied: the source keeps its episodes but not their bets.
  src_state := jsonb_set(src_state, '{episodes}', (
    SELECT COALESCE(jsonb_agg(
             CASE WHEN jsonb_typeof(e->'bets') = 'array' THEN jsonb_set(e, '{bets}', '[]'::jsonb) ELSE e END
             ORDER BY o), '[]'::jsonb)
      FROM jsonb_array_elements(src_state->'episodes') WITH ORDINALITY t(e, o)));

  UPDATE leagues SET state = tgt_state, updated_at = now() WHERE id = tgt_id;
  UPDATE leagues SET state = src_state, updated_at = now() WHERE id = src_id;
  RAISE NOTICE '0045: moved % predictions (% guesses) from T9FUMY to B999RR', moved_bets, moved_preds;
END $$;
