import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { readyLeague } from "./league-read";

// Step 2.6 (docs/PLAN-sports-ready.md; BACKLOG 218), the clock's half of sport-pace.ts: every sports game at its own pace readied,
// so a seat the next game's start has passed moves on within the hour even when nobody reads it (the hub and Tonight read a
// person's mark from the game's state: guard.ts paceMark). Run by the hourly sports job (db/sports-refresh.js) after its refresh,
// so a game's start it has just learned of (a makeup, a moved game) counts. A read with nothing due writes nothing.

/** Readies every sports game at its own pace (`only`: these leagues alone, a check's). Answers how many were read. */
export async function keepAllSportPace(only?: string[]): Promise<number> {
  const { rows } = await pool.query(
    `SELECT l.id, l.state FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId' AND s.kind = 'sport'
      WHERE l.deleted_at IS NULL AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''
        AND l.state->'settings'->>'ownPace' = 'true' AND ($1::uuid[] IS NULL OR l.id = ANY($1::uuid[]))`,
    [only ?? null]
  );
  let read = 0;
  for (const r of rows) {
    try {
      await readyLeague(r.id as string, r.state as LeagueState);
      read++;
    } catch (e) {
      // One game's bad state mustn't hold up the rest.
      console.error(`[sport-pace] league ${r.id}:`, e);
    }
  }
  return read;
}
