import { pool, HttpError } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";

// Per-person progress and following (db/migrations/0102 show_follows): where someone is in a season, and
// whether they follow it, watching privately or not.
//
// For a season someone plays, progress follows their leagues. league_memberships.results_seen_through stays
// the classic app's mark, and every classic write of it (results-seen.ts, the late-join route) calls
// followLeagueProgress, which moves the follow forward to match: the two designs never disagree. Moving it
// back isn't possible, as in classic (once seen, seen); the new design's own reveal comes in step 2.
//
// Every write of seen_through is here (this and setFollow: the new design's reveal, a watch along's End and rating an
// episode come through one or the other), so this is also where finished_at is kept (migration 0134, step 14 part 2):
// when the mark first reaches the season's last episode (show_seasons.episode_count), cleared if it moves back from it.
// By the numbers' First to finish reads it (couch-hub.ts).

/** The league's mark for this member, carried onto their follow of its season (forward only). Best effort. */
export async function followLeagueProgress(userId: string, leagueId: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, seen_through, finished_at)
       SELECT m.user_id, ss.id, COALESCE(m.results_seen_through, 0),
              CASE WHEN ss.episode_count > 0 AND COALESCE(m.results_seen_through, 0) >= ss.episode_count THEN now() END
         FROM league_memberships m JOIN leagues l ON l.id = m.league_id
         ${LEAGUE_SEASON_JOIN}
        WHERE m.league_id = $1 AND m.user_id = $2
       ON CONFLICT (user_id, season_id) DO UPDATE
          SET seen_through = EXCLUDED.seen_through, updated_at = now(), finished_at = COALESCE(show_follows.finished_at, EXCLUDED.finished_at)
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
  /** The hub's "you both watch" nudge for this show: true once it's been answered (Not now), so it's never asked again. */
  nudgeOff?: unknown;
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
  const set: Record<string, string> = {};
  // What an existing follow's row takes instead, where that differs from a new one's.
  const onUpdate: Record<string, string> = {};
  if (change.nudgeOff !== undefined) {
    if (typeof change.nudgeOff !== "boolean") throw new HttpError(400, "nudgeOff must be true or false");
    set.nudge_off_at = change.nudgeOff ? "now()" : "NULL";
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
    // Finished: when the mark first reached the last episode; moving back from it takes that away.
    const done = !!season[0].episode_count && (n as number) >= (season[0].episode_count as number);
    set.finished_at = done ? "now()" : "NULL";
    onUpdate.finished_at = done ? "COALESCE(show_follows.finished_at, now())" : "NULL";
  }
  if (!Object.keys(fields).length && !Object.keys(set).length) throw new HttpError(400, "Nothing to change");
  const cols = Object.keys(fields);
  const fixed = Object.keys(set);
  if (!cols.length) {
    // Only the nudge: on a follow that's there (answering it never follows a show).
    const { rows } = await pool.query(
      `UPDATE show_follows SET ${fixed.map((c) => `${c} = ${set[c]}`).join(", ")}, updated_at = now() WHERE user_id = $1 AND season_id = $2
       RETURNING seen_through AS "seenThrough", following, private`,
      [userId, seasonId]
    );
    if (!rows.length) throw new HttpError(404, "You don't follow that show");
    return rows[0] as { seenThrough: number; following: boolean; private: boolean };
  }
  const { rows } = await pool.query(
    `INSERT INTO show_follows (user_id, season_id${[...cols, ...fixed].map((c) => `, ${c}`).join("")})
     VALUES ($1, $2${cols.map((_, i) => `, $${i + 3}`).join("")}${fixed.map((c) => `, ${set[c]}`).join("")})
     ON CONFLICT (user_id, season_id) DO UPDATE SET ${[...cols.map((c) => `${c} = EXCLUDED.${c}`), ...fixed.map((c) => `${c} = ${onUpdate[c] ?? set[c]}`)].join(", ")}, updated_at = now()
     RETURNING seen_through AS "seenThrough", following, private`,
    [userId, seasonId, ...cols.map((c) => fields[c])]
  );
  return rows[0] as { seenThrough: number; following: boolean; private: boolean };
}
