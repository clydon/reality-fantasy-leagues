-- Backfills two fields added to the leagues.state JSONB:
--   * midSeason.log -- the replenish/swap history the Mid-Season panels render.
--   * settings.finalePredictionsEnabled -- the new opt-in toggle for Finale Predictions.
--
-- Same reason 0003 exists: league rows are read straight out of this column without running
-- Migrations.migrateLeagueState (that only runs on backup import), so a code-only default would
-- never reach an existing league. Without this, finalePredictionsAvailable() reads the missing flag
-- as "off" and hides Finale Predictions from leagues that were already using them.
--
-- The finale default mirrors migrateLeagueState's: ON only where predictions or an actual result
-- already exist, so picks already made aren't stranded; OFF otherwise, like a new league.
--
-- History from before this point can't be reconstructed (nothing recorded it), so the log starts
-- empty. Idempotent: each UPDATE skips rows that already have the field.

UPDATE leagues
SET state = jsonb_set(
      state,
      '{midSeason}',
      CASE WHEN jsonb_typeof(state->'midSeason') = 'object'
           THEN state->'midSeason'
           ELSE '{"replenish":null,"trade":null}'::jsonb
      END || '{"log":[]}'::jsonb
    ),
    updated_at = now()
WHERE NOT (CASE WHEN jsonb_typeof(state->'midSeason') = 'object'
                THEN state->'midSeason' ? 'log'
                ELSE false
           END);

UPDATE leagues
SET state = jsonb_set(
      state,
      '{settings,finalePredictionsEnabled}',
      to_jsonb(
        (CASE WHEN jsonb_typeof(state->'finalePredictions') = 'array'
              THEN jsonb_array_length(state->'finalePredictions') > 0
              ELSE false
         END)
        OR (state->'finaleActual'->>'winner') IS NOT NULL
        OR EXISTS (
             SELECT 1
             FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(state->'finaleActual'->'top3') = 'array'
                         THEN state->'finaleActual'->'top3'
                         ELSE '[]'::jsonb
                    END
                  ) AS e
             WHERE e <> 'null'::jsonb
           )
      )
    ),
    updated_at = now()
WHERE jsonb_typeof(state->'settings') = 'object'
  AND NOT (state->'settings' ? 'finalePredictionsEnabled');
