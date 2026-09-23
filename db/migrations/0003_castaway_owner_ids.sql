-- Castaway ownership: scalar `ownerId` -> `ownerIds` array, inside the leagues.state JSONB.
--
-- Why this needs a real migration even though ownership lives in JSONB rather than in columns:
-- withLeagueLock (src/lib/server/db.ts) and every `SELECT state FROM leagues` read hand the stored
-- JSON straight to the game logic WITHOUT running Migrations.migrateLeagueState -- that only runs
-- on backup import (src/app/api/leagues/[leagueId]/import/route.ts). So a code-only rename would
-- leave every existing league with an `ownerId` the new code never reads: no rosters, and every
-- player's locked points silently reset to 0. Hence this one-time conversion.
--
-- Exclusive ownership is the only mode any existing league can be in, so an owner becomes a
-- one-element array and an unowned castaway becomes an empty one. `formerOwnerId` is deliberately
-- left as a scalar -- it's history/display only, never summed into a score.
--
-- Idempotent: a castaway that already has `ownerIds` keeps it untouched, and the WHERE clause
-- skips league rows where no castaway carries the old key at all.

UPDATE leagues
SET state = jsonb_set(
      state,
      '{castaways}',
      (
        SELECT COALESCE(jsonb_agg(
                 CASE
                   -- Already converted: just make sure no stale scalar lingers alongside the array.
                   WHEN c ? 'ownerIds' THEN c - 'ownerId'
                   ELSE (c - 'ownerId') || jsonb_build_object(
                          'ownerIds',
                          CASE
                            -- Covers both a missing key and an explicit JSON null.
                            WHEN c->>'ownerId' IS NULL THEN '[]'::jsonb
                            ELSE jsonb_build_array(c->'ownerId')
                          END
                        )
                 END
                 ORDER BY ord   -- cast order is meaningful (draft board, roster display)
               ), '[]'::jsonb)
        FROM jsonb_array_elements(state->'castaways') WITH ORDINALITY AS t(c, ord)
      )
    ),
    updated_at = now()
WHERE jsonb_typeof(state->'castaways') = 'array'
  AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(state->'castaways') e WHERE e ? 'ownerId'
      );
