import { pool } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { latestAired, seasonSchedules } from "./schedule";

// Keeping up with a show you follow (db/migrations/0141 show_follows.keep_up): how where you are moves as episodes air.
//   off   only when you move it.
//   ask   Live: when each new episode ends, Tonight asks "Seen it?" (show/tonight.tsx SeenItCard). Nothing moves until you say,
//         so watching one late next week spoils nothing; "Not yet" (not_yet) keeps it from asking again until a newer one ends.
//   auto  moves itself to each episode as it airs (Settings, with its spoiler warning). seen_through is written forward here, so
//         every reader of the mark (guard.ts, and the queries that read a couch's marks straight from show_follows) agrees: on
//         your own reads (guard.ts seenThrough) and on the bot clock for everyone (advanceAllAuto, /api/cron/bot-research).
// Never on a season you play: that one moves with your games' reveals (follows.ts), and a keep_up left on it is ignored.

type Queryable = { query: typeof pool.query };

export type KeepUp = "off" | "ask" | "auto";
export const KEEP_UPS: readonly KeepUp[] = ["off", "ask", "auto"];

/**
 * Move auto follows of these seasons forward to the latest episode that's aired (started): `userId`'s alone, or everyone's.
 * Forward only, never past what's aired, never on a season the person plays. Answers the marks it moved, "user/season" to
 * the episode.
 */
export async function advanceAuto(seasonIds: string[], userId: string | null = null, db: Queryable = pool, now = new Date()): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(seasonIds)];
  if (!ids.length) return out;
  const schedules = await seasonSchedules(ids, now);
  const aired = ids.map((id) => latestAired(schedules.get(id), now));
  const { rows } = await db.query(
    `UPDATE show_follows f
        SET seen_through = x.n, not_yet = NULL, updated_at = now(),
            finished_at = CASE WHEN ss.episode_count > 0 AND x.n >= ss.episode_count THEN COALESCE(f.finished_at, now()) ELSE f.finished_at END
       FROM unnest($1::uuid[], $2::int[]) AS x(season_id, n), show_seasons ss
      WHERE f.season_id = x.season_id AND ss.id = x.season_id AND f.keep_up = 'auto' AND f.seen_through < x.n
        AND ($3::text IS NULL OR f.user_id = $3)
        AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
                         WHERE m.user_id = f.user_id AND ss.id = f.season_id)
      RETURNING f.user_id, f.season_id, f.seen_through`,
    [ids, aired, userId]
  );
  for (const r of rows) out.set(`${r.user_id}/${r.season_id}`, r.seen_through as number);
  return out;
}

/** Every auto follow, moved forward (the bot clock's job). Best effort: answers how many marks moved. */
export async function advanceAllAuto(db: Queryable = pool): Promise<number> {
  const { rows } = await db.query("SELECT DISTINCT season_id FROM show_follows WHERE keep_up = 'auto'");
  if (!rows.length) return 0;
  return (await advanceAuto(rows.map((r) => r.season_id as string), null, db)).size;
}

/**
 * Live's question on Tonight: the episode to ask "Seen it?" about, or null. The latest that has ended, when it's past where
 * you are and you haven't said Not yet to it (or anything newer).
 */
export function seenItAsk(f: { keepUp: KeepUp; seen: number; notYet: number | null }, ended: number): number | null {
  if (f.keepUp !== "ask" || ended <= f.seen) return null;
  if (f.notYet != null && f.notYet >= ended) return null;
  return ended;
}
