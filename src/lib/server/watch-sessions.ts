import { BEAT_WRITE_MS, MAX_RUNTIME_MS, PRESENT_MS, type Watcher, type WatchMode } from "@/lib/game/watch-along";
import { pool } from "./db";

// Who's on now (docs/PLAN-new-design.md step 13 part 2; migration 0132 watch_sessions and watch_session_people): each open watch
// along keeps its clock here, written when it starts, pauses, moves or ends, with a heartbeat while it's open and in front (the
// running watch along's 5 s read, or a paused one's beat every 20 s for ten minutes). Someone is watching now while their
// heartbeat is under PRESENT_MS old and they haven't left; a closed tab or a phone gone to sleep just drops out, worked out when
// read (nothing sweeps them). watch-along.ts checks who may write and read; this is the SQL.
//
// Presence is progress ("riley is watching Episode 7 now" says how far she is), so it's shown as reactions are heard: only someone
// who follows the show openly (show_follows following and not private: never a private watcher), only on the couch they opened it
// on (a session alone is nobody else's), and only to the rest of that couch. Never what happens in the episode.

/** Their own session (part 2's: one per person, episode and couch), keyed as watch_sessions_own is. */
const OWN = `s.started_by = $1 AND NOT s.together AND s.season_id = $2 AND s.episode = $3 AND s.couch_id IS NOT DISTINCT FROM $4::uuid`;

export interface SessionClock {
  at: number;
  mode: WatchMode;
  running: boolean;
  ad: boolean;
}

/** Start or move your own watch along's clock (and you're in it, watching now). Returns the session's id and version. */
export async function writeOwnSession(userId: string, seasonId: string, episode: number, couchId: string | null, clock: SessionClock): Promise<{ id: string; version: number }> {
  const at = Math.max(0, Math.min(MAX_RUNTIME_MS, Math.floor(clock.at)));
  const { rows } = await pool.query(
    `WITH s AS (
       INSERT INTO watch_sessions (season_id, episode, couch_id, started_by, mode, clock_ms, running_since, ad)
       VALUES ($2, $3, $4, $1, $5, $6, CASE WHEN $7 THEN now() END, $8)
       ON CONFLICT (started_by, season_id, episode, (COALESCE(couch_id, '00000000-0000-0000-0000-000000000000'::uuid))) WHERE NOT together
       DO UPDATE SET mode = EXCLUDED.mode, clock_ms = EXCLUDED.clock_ms, running_since = EXCLUDED.running_since, ad = EXCLUDED.ad,
                     version = watch_sessions.version + 1, updated_at = now()
       RETURNING id, version
     ), p AS (
       INSERT INTO watch_session_people (session_id, user_id) SELECT id, $1 FROM s
       ON CONFLICT (session_id, user_id) DO UPDATE SET seen_at = now(), left_at = NULL
     )
     SELECT id, version FROM s`,
    [userId, seasonId, episode, couchId, clock.mode, at, clock.running && !clock.ad, clock.ad && !clock.running]
  );
  return { id: rows[0].id as string, version: rows[0].version as number };
}

/** Closed (or ended): the clock stops where it is and you're no longer watching now. */
export async function leaveOwnSession(userId: string, seasonId: string, episode: number, couchId: string | null, at: number | null): Promise<void> {
  await pool.query(
    `WITH s AS (
       UPDATE watch_sessions s SET clock_ms = COALESCE($5, LEAST(${MAX_RUNTIME_MS}, s.clock_ms + CASE WHEN s.running_since IS NULL THEN 0
                ELSE (EXTRACT(EPOCH FROM (now() - s.running_since)) * 1000)::int END)),
              running_since = NULL, ad = false, version = s.version + 1, updated_at = now()
        WHERE ${OWN}
       RETURNING s.id
     )
     UPDATE watch_session_people p SET left_at = now() FROM s WHERE p.session_id = s.id AND p.user_id = $1`,
    [userId, seasonId, episode, couchId, at === null ? null : Math.max(0, Math.min(MAX_RUNTIME_MS, Math.floor(at)))]
  );
}

/**
 * Your watch along is still open: its heartbeat. `always` (a paused one's beat, or coming back to the tab) writes it, and brings back
 * a session you'd left (a page come back from the cache); the running poll's writes only when the last is BEAT_WRITE_MS old, so most
 * polls just look, and never brings back one you've left (a poll still on its way as you closed it).
 */
export async function beatOwnSession(userId: string, seasonId: string, episode: number, couchId: string | null, always: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE watch_session_people p SET seen_at = now(), left_at = NULL
       FROM watch_sessions s
      WHERE p.session_id = s.id AND p.user_id = $1 AND ${OWN}
        ${always ? "" : `AND p.left_at IS NULL AND p.seen_at < now() - interval '${BEAT_WRITE_MS} milliseconds'`}`,
    [userId, seasonId, episode, couchId]
  );
  return (rowCount ?? 0) > 0;
}

type WatcherRow = Watcher & { seasonId: string };

/**
 * Who else on a couch is watching now: each person once (their freshest session), on the couch they opened it on, following its
 * show openly, still on the couch. Narrowed to a season, and to an episode of it, when asked. Each clock is read at the database's
 * now (where it stood, plus how long it's run since).
 */
export async function watchersOn(viewerId: string, couchId: string, where: { seasonId?: string; episode?: number } = {}): Promise<WatcherRow[]> {
  const params: unknown[] = [couchId, viewerId];
  const and: string[] = [];
  if (where.seasonId) and.push(`s.season_id = $${params.push(where.seasonId)}`);
  if (where.episode) and.push(`s.episode = $${params.push(where.episode)}`);
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.user_id) p.user_id, COALESCE(u.username, u.name) AS name, s.season_id, s.episode, s.mode, s.ad,
            s.running_since IS NOT NULL AS running,
            LEAST(${MAX_RUNTIME_MS}, s.clock_ms + CASE WHEN s.running_since IS NULL THEN 0
                  ELSE (EXTRACT(EPOCH FROM (now() - s.running_since)) * 1000)::int END) AS at
       FROM watch_session_people p
       JOIN watch_sessions s ON s.id = p.session_id
       JOIN "user" u ON u.id = p.user_id
      WHERE p.seen_at > now() - interval '${PRESENT_MS} milliseconds' AND p.left_at IS NULL
        AND s.couch_id = $1 AND p.user_id <> $2
        AND p.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = $1)
        AND EXISTS (SELECT 1 FROM show_follows f WHERE f.user_id = p.user_id AND f.season_id = s.season_id AND f.following AND NOT f.private)
        ${and.map((c) => `AND ${c}`).join(" ")}
      ORDER BY p.user_id, p.seen_at DESC`,
    params
  );
  return rows
    .map((r) => ({
      userId: r.user_id as string,
      name: r.name as string,
      seasonId: r.season_id as string,
      episode: r.episode as number,
      mode: r.mode as WatchMode,
      at: Number(r.at),
      running: !!r.running,
      ad: !!r.ad,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A watcher as the screen gets it (the season is the one asked about). */
export const asWatcher = (r: WatcherRow): Watcher => ({ userId: r.userId, name: r.name, episode: r.episode, mode: r.mode, at: r.at, running: r.running, ad: r.ad });
