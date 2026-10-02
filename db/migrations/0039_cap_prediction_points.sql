-- Predictions are worth at most 3 points now (BetLogic.MAX_BET_POINTS: at about one a week, that keeps
-- them to roughly a quarter of what decides a Classic league). New and edited ones are capped as
-- they're written; this brings any existing one above 3 down to 3.
UPDATE leagues l
   SET state = jsonb_set(l.state, '{episodes}', (
     SELECT jsonb_agg(
              CASE WHEN jsonb_typeof(ep->'bets') = 'array' THEN
                jsonb_set(ep, '{bets}', (
                  SELECT COALESCE(jsonb_agg(
                           CASE WHEN jsonb_typeof(b->'points') = 'number' AND (b->>'points')::numeric > 3
                                THEN jsonb_set(b, '{points}', '3'::jsonb) ELSE b END
                           ORDER BY bo), '[]'::jsonb)
                    FROM jsonb_array_elements(ep->'bets') WITH ORDINALITY AS bb(b, bo)))
              ELSE ep END
              ORDER BY eo)
       FROM jsonb_array_elements(l.state->'episodes') WITH ORDINALITY AS ee(ep, eo)))
 WHERE jsonb_typeof(l.state->'episodes') = 'array'
   AND EXISTS (
     SELECT 1 FROM jsonb_array_elements(l.state->'episodes') ep, jsonb_array_elements(COALESCE(ep->'bets', '[]'::jsonb)) b
      WHERE jsonb_typeof(b->'points') = 'number' AND (b->>'points')::numeric > 3);
