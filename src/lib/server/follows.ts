import { pool, HttpError } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";

// Per-person progress and following (db/migrations/0102 show_follows): where someone is in a season, and
// whether they follow it, watching privately or not.
//
// For a season someone plays, progress follows their leagues. league_memberships.results_seen_through stays
// the classic app's mark, and every classic write of it (results-seen.ts, the late-join route) calls
// followLeagueProgress, which moves the follow forward to match: the two designs never disagree. Moving it
// back isn't possible, as in classic (once seen, seen); the new design's own reveal comes in step 2.

/** The league's mark for this member, carried onto their follow of its season (forward only). Best effort. */
export async function followLeagueProgress(userId: string, leagueId: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, seen_through)
       SELECT m.user_id, ss.id, COALESCE(m.results_seen_through, 0)
         FROM league_memberships m JOIN leagues l ON l.id = m.league_id
         ${LEAGUE_SEASON_JOIN}
        WHERE m.league_id = $1 AND m.user_id = $2
       ON CONFLICT (user_id, season_id) DO UPDATE
          SET seen_through = EXCLUDED.seen_through, updated_at = now()
        WHERE EXCLUDED.seen_through > show_follows.seen_through`,
      [leagueId, userId]
    );
  } catch (e) {
    console.error(`[follows] league ${leagueId}:`, e);
  }
}

export interface FollowChange {
  seenThrough?: unknown;
  following?: unknown;
  private?: unknown;
}

/**
 * The new design's PUT /api/me/follows/[seasonId]: follow or unfollow a season, watch it privately, and say
 * where you are in it. Where you are can go either way (it's yours to correct), except on a season you play,
 * where it comes from your games' reveals.
 */
export async function setFollow(userId: string, seasonId: string, change: FollowChange) {
  const { rows: season } = await pool.query("SELECT id, episode_count FROM show_seasons WHERE id = $1", [seasonId]);
  if (!season.length) throw new HttpError(404, "Season not found");
  const fields: Record<string, boolean | number> = {};
  for (const key of ["following", "private"] as const) {
    if (change[key] === undefined) continue;
    if (typeof change[key] !== "boolean") throw new HttpError(400, `${key} must be true or false`);
    fields[key] = change[key] as boolean;
  }
  if (change.seenThrough !== undefined) {
    const n = change.seenThrough;
    const max = (season[0].episode_count as number | null) ?? 200;
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > max) throw new HttpError(400, `seenThrough must be an episode from 0 to ${max}`);
    const { rows: plays } = await pool.query(
      `SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
        WHERE m.user_id = $1 AND ss.id = $2 LIMIT 1`,
      [userId, seasonId]
    );
    if (plays.length) throw new HttpError(409, "You play this season: where you are moves with your games' reveals.");
    fields.seen_through = n as number;
  }
  if (!Object.keys(fields).length) throw new HttpError(400, "Nothing to change");
  const cols = Object.keys(fields);
  const { rows } = await pool.query(
    `INSERT INTO show_follows (user_id, season_id, ${cols.join(", ")}) VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(", ")})
     ON CONFLICT (user_id, season_id) DO UPDATE SET ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}, updated_at = now()
     RETURNING seen_through AS "seenThrough", following, private`,
    [userId, seasonId, ...cols.map((c) => fields[c])]
  );
  return rows[0] as { seenThrough: number; following: boolean; private: boolean };
}
