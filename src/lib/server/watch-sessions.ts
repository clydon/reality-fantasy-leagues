import { BEAT_WRITE_MS, COUNTDOWN_MS, MAX_RUNTIME_MS, PRESENT_MS, type TogetherChange, type Watcher, type WatchMode } from "@/lib/game/watch-along";
import { pool } from "./db";
import { sharesSql } from "./guard";

// Who's on now (docs/PLAN-new-design.md step 13 part 2; migration 0132 watch_sessions and watch_session_people): each open watch
// along keeps its clock here, written when it starts, pauses, moves or ends, with a heartbeat while it's open and in front (the
// running watch along's 5 s read, or a paused one's beat every 20 s for ten minutes). Someone is watching now while their
// heartbeat is under PRESENT_MS old and they haven't left; a closed tab or a phone gone to sleep just drops out, worked out when
// read (nothing sweeps them). watch-along.ts checks who may write and read; this is the SQL.
//
// Presence is progress ("riley is watching Episode 7 now" says how far she is), so it's shown only for someone who follows the show
// openly (never a private watcher) and shares When I'm watching (step 15 part 3's What your couch sees: guard.ts sharesSql), only on
// the couch they opened it on (a session alone is nobody else's), and only to the rest of that couch. Never what happens in the
// episode.
//
// Together sessions (step 13 part 3; migration 0133): a planned night's watch along, one clock for everyone in it. Joining it
// leaves your own session of that episode on the couch; anyone in it moves the clock for all (`moveTogether`: version bumped,
// who did what kept); the last one out stops it where it is. Who's in one shows in watchersOn as anyone's own does (people, not
// sessions), each with the session's clock.

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
 * show openly and sharing When I'm watching, still on the couch. Narrowed to a season, and to an episode of it, when asked. Each clock is read at the database's
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
        AND ${sharesSql("now", "p.user_id", "s.season_id")}
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

// ---------- together sessions (step 13 part 3) ----------

/** A clock as SQL reads it at the database's now (`s`): where it stood, plus how long it's run (nothing before a "3, 2, 1" ends). */
const CLOCK_AT = `LEAST(${MAX_RUNTIME_MS}, s.clock_ms + CASE WHEN s.running_since IS NULL OR s.running_since > now() THEN 0
                  ELSE (EXTRACT(EPOCH FROM (now() - s.running_since)) * 1000)::int END)`;
const HERE = (p: string) => `${p}.left_at IS NULL AND ${p}.seen_at > now() - interval '${PRESENT_MS} milliseconds'`;

export interface TogetherRow {
  id: string;
  planId: string;
  seasonId: string;
  episode: number;
  couchId: string;
  version: number;
  mode: WatchMode;
  /** Where the clock is at the database's now (ms); during a "3, 2, 1", where it starts. */
  at: number;
  running: boolean;
  ad: boolean;
  /** A "3, 2, 1" still counting: ms until the clock runs. */
  startsInMs: number;
  change: TogetherChange | null;
  changedBy: { userId: string; name: string } | null;
  changedAt: string | null;
  createdAt: string;
  /** Who's joined it, first in first: here now (a recent heartbeat, not left) or not. */
  people: { userId: string; name: string; here: boolean }[];
  /** Bingo squares ticked by the people in it since it began (an open card reads again when this moves). */
  ticks: number;
}

/** A planned night's together session (or one by its id), or null before anyone's opened it. */
export async function togetherOf(by: { planId: string } | { id: string }): Promise<TogetherRow | null> {
  const { rows } = await pool.query(
    `SELECT s.id, s.plan_id, s.season_id, s.episode, s.couch_id, s.version, s.mode, s.ad, s.change, s.changed_by,
            COALESCE(cu.username, cu.name) AS changed_name, s.changed_at, s.created_at,
            s.running_since IS NOT NULL AS running,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (COALESCE(s.running_since, now()) - now())) * 1000))::int AS starts_in,
            ${CLOCK_AT} AS at,
            COALESCE((SELECT json_agg(json_build_object('userId', p.user_id, 'name', COALESCE(u.username, u.name), 'here', ${HERE("p")}) ORDER BY p.joined_at)
                        FROM watch_session_people p JOIN "user" u ON u.id = p.user_id WHERE p.session_id = s.id), '[]'::json) AS people,
            (SELECT count(*)::int FROM bingo_marks m JOIN bingo_cards c ON c.id = m.card_id
               JOIN watch_session_people p ON p.user_id = c.user_id AND p.session_id = s.id
              WHERE c.season_id = s.season_id AND c.episode = s.episode AND m.marked_at >= s.created_at) AS ticks
       FROM watch_sessions s LEFT JOIN "user" cu ON cu.id = s.changed_by
      WHERE s.together AND ${"planId" in by ? "s.plan_id = $1" : "s.id = $1"}`,
    ["planId" in by ? by.planId : by.id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    planId: r.plan_id,
    seasonId: r.season_id,
    episode: r.episode,
    couchId: r.couch_id,
    version: r.version,
    mode: r.mode,
    at: Number(r.at),
    running: !!r.running,
    ad: !!r.ad,
    startsInMs: Number(r.starts_in),
    change: r.change,
    changedBy: r.changed_by ? { userId: r.changed_by, name: r.changed_name } : null,
    changedAt: r.changed_at ? new Date(r.changed_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    people: r.people,
    ticks: r.ticks,
  };
}

/**
 * The poll's look (one small query by the session's key): a together session of this episode on this couch that you're in (not
 * left), still on the couch, its night not called off; its id, version and night. Null otherwise (then the caller reads it in full,
 * with every check).
 */
export async function togetherLook(
  userId: string,
  by: { planId: string } | { id: string },
  where: { seasonId: string; episode: number; couchId: string }
): Promise<{ id: string; version: number; planId: string } | null> {
  const { rows } = await pool.query(
    `SELECT s.id, s.version, s.plan_id
       FROM watch_sessions s
       JOIN watch_session_people p ON p.session_id = s.id AND p.user_id = $1 AND p.left_at IS NULL
       JOIN watch_plans w ON w.id = s.plan_id AND w.cancelled_at IS NULL
      WHERE s.together AND ${"planId" in by ? "s.plan_id" : "s.id"} = $2 AND s.season_id = $3 AND s.episode = $4 AND s.couch_id = $5
        AND EXISTS (SELECT 1 FROM couch_members m WHERE m.couch_id = s.couch_id AND m.user_id = $1)`,
    [userId, "planId" in by ? by.planId : by.id, where.seasonId, where.episode, where.couchId]
  );
  return rows[0] ? { id: rows[0].id as string, version: rows[0].version as number, planId: rows[0].plan_id as string } : null;
}

/** A together session's version, for the poll's look (a few bytes); null when there's none. */
export async function togetherVersion(sessionId: string): Promise<number | null> {
  const { rows } = await pool.query("SELECT version FROM watch_sessions WHERE id = $1 AND together", [sessionId]);
  return rows[0] ? (rows[0].version as number) : null;
}

/**
 * Join a planned night's together session, making it if nobody has (its clock as `first` says: the live airing's, running, or a
 * shared start's, waiting for someone to start it), and leave your own session of the episode on the couch and any other together
 * one of it there. Joining moves its version on (who's here changed). Returns its id.
 */
export async function joinTogether(
  userId: string,
  plan: { id: string; couchId: string; seasonId: string; episode: number },
  first: SessionClock & { change: TogetherChange | null }
): Promise<string> {
  const at = Math.max(0, Math.min(MAX_RUNTIME_MS, Math.floor(first.at)));
  const { rows } = await pool.query(
    `WITH s AS (
       INSERT INTO watch_sessions (season_id, episode, couch_id, started_by, together, plan_id, mode, clock_ms, running_since, ad, change, changed_by, changed_at)
       VALUES ($2, $3, $4, $1, true, $5, $6, $7, CASE WHEN $8 THEN now() END, $9, $10::text,
               CASE WHEN $10::text IS NOT NULL THEN $1 END, CASE WHEN $10::text IS NOT NULL THEN now() END)
       ON CONFLICT (plan_id) WHERE together DO UPDATE SET version = watch_sessions.version + 1, updated_at = now()
       RETURNING id
     )
     INSERT INTO watch_session_people (session_id, user_id) SELECT id, $1 FROM s
     ON CONFLICT (session_id, user_id) DO UPDATE SET seen_at = now(), left_at = NULL
     RETURNING session_id`,
    [userId, plan.seasonId, plan.episode, plan.couchId, plan.id, first.mode, at, first.running && !first.ad, first.ad && !first.running, first.change]
  );
  const id = rows[0].session_id as string;
  await Promise.all([
    leaveOwnSession(userId, plan.seasonId, plan.episode, plan.couchId, null),
    pool.query(
      `UPDATE watch_session_people p SET left_at = now() FROM watch_sessions s
        WHERE p.session_id = s.id AND p.user_id = $1 AND p.left_at IS NULL AND s.together AND s.id <> $2
          AND s.season_id = $3 AND s.episode = $4 AND s.couch_id = $5`,
      [userId, id, plan.seasonId, plan.episode, plan.couchId]
    ),
  ]);
  return id;
}

/**
 * Move a together session's clock for everyone in it (start: a "3, 2, 1", COUNTDOWN_MS from now; pause, resume, an ad break and
 * back, or a move), as one of them who hasn't left; it's your heartbeat too. False when you're not in it.
 */
export async function moveTogether(userId: string, sessionId: string, clock: SessionClock, change: TogetherChange): Promise<boolean> {
  const at = Math.max(0, Math.min(MAX_RUNTIME_MS, Math.floor(clock.at)));
  const starting = change === "start";
  const running = starting || (clock.running && !clock.ad);
  const { rowCount } = await pool.query(
    `WITH s AS (
       UPDATE watch_sessions s SET mode = $3, clock_ms = $4,
              running_since = CASE WHEN $5::text = 'start' THEN now() + interval '${COUNTDOWN_MS} milliseconds' WHEN $6 THEN now() END,
              ad = $7, change = $5::text, changed_by = $1, changed_at = now(), version = s.version + 1, updated_at = now()
        WHERE s.id = $2 AND s.together
          AND EXISTS (SELECT 1 FROM watch_session_people p WHERE p.session_id = s.id AND p.user_id = $1 AND p.left_at IS NULL)
       RETURNING s.id
     )
     UPDATE watch_session_people p SET seen_at = now() FROM s WHERE p.session_id = s.id AND p.user_id = $1`,
    [userId, sessionId, clock.mode, at, change, running, clock.ad && !running]
  );
  return (rowCount ?? 0) > 0;
}

/** Your together watch along is still open: as beatOwnSession (`always` brings you back after a page come back from the cache). */
export async function beatTogether(userId: string, sessionId: string, always: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE watch_session_people p SET seen_at = now(), left_at = NULL
      WHERE p.session_id = $2 AND p.user_id = $1
        ${always ? "" : `AND p.left_at IS NULL AND p.seen_at < now() - interval '${BEAT_WRITE_MS} milliseconds'`}`,
    [userId, sessionId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * You closed it (or ended it): you're out, and its clock carries on for the rest. When nobody else is here it stops where it is
 * (so whoever opens it again picks up there), as a pause nobody made. Its version moves on (who's here changed).
 */
export async function leaveTogether(userId: string, sessionId: string): Promise<void> {
  await pool.query(
    `WITH p AS (
       UPDATE watch_session_people SET left_at = now() WHERE session_id = $2 AND user_id = $1 AND left_at IS NULL RETURNING session_id
     ), alone AS (
       SELECT NOT EXISTS (SELECT 1 FROM watch_session_people o WHERE o.session_id = $2 AND o.user_id <> $1 AND ${HERE("o")}) AS v
     )
     UPDATE watch_sessions s SET
            clock_ms = CASE WHEN alone.v THEN ${CLOCK_AT} ELSE s.clock_ms END,
            running_since = CASE WHEN alone.v THEN NULL ELSE s.running_since END,
            change = CASE WHEN alone.v AND s.running_since IS NOT NULL THEN 'pause' ELSE s.change END,
            changed_by = CASE WHEN alone.v AND s.running_since IS NOT NULL THEN NULL ELSE s.changed_by END,
            changed_at = CASE WHEN alone.v AND s.running_since IS NOT NULL THEN now() ELSE s.changed_at END,
            version = s.version + 1, updated_at = now()
       FROM p, alone WHERE s.id = p.session_id`,
    [userId, sessionId]
  );
}
