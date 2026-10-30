import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { pool } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { READ_ONLY_HEADER } from "@/lib/read-only";

// Open it read-only, on the server (docs/PLAN-desk-parity.md part 6c, Noticed r): a site admin's read scope over one
// couch's game, never a membership. The show space's reads (/space, /games, /episodes) take a request carrying
// READ_ONLY_HEADER as the couch sees that game: it alone, with no seat of yours in it, at your own spoiler mark (game-view.ts
// couchView). Stats and How it works already read a couch's games whoever asks (requireCouch lets a site admin in as a
// viewer). Tonight's jobs and the couch's chat aren't read at all. The writes the header carries are refused before any
// route runs (api-route.ts).

export interface ReadOnly {
  leagueId: string;
  couchId: string;
  seasonId: string;
}

/**
 * The game open read-only for this request, when it's a site admin's (not someone acting as another: then they're that
 * person) and the read is about that game's couch and season; else null, and the read is the viewer's own as ever (a tab
 * that has just left read-only may send one more).
 */
export async function readOnlyFor(req: Request, user: SessionUser, seasonId: string, couchId: string | null): Promise<ReadOnly | null> {
  const leagueId = req.headers.get(READ_ONLY_HEADER);
  if (!leagueId || !couchId || !isUuid(leagueId) || !isSuperAdminUser(user)) return null;
  const { rows } = await pool.query(
    `SELECT l.couch_id, ss.id AS season_id FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE l.id = $1 AND l.deleted_at IS NULL AND l.couch_id IS NOT NULL`,
    [leagueId]
  );
  if (!rows[0] || rows[0].couch_id !== couchId || rows[0].season_id !== seasonId) return null;
  return { leagueId, couchId, seasonId };
}
