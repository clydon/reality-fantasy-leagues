import { isUuid } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { DEFAULT_RUNTIME_MIN, type SeasonSchedule } from "./schedule";

// The TV guide, the server's half (docs/PLAN-new-design.md step 11 part 1): what the home read sends for each show's
// guide (its episodes around this week: when each starts and how long it runs, never a title), and Hide from guide
// (db/migrations/0125 guide_hidden). The layout (days, the Now line, Same time, drops) is the pure src/lib/game/guide.ts,
// in the browser, because the days are the viewer's own.

export interface WeekEpisode {
  number: number;
  airAt: string;
  runtimeMin: number | null;
}

// From a day and a bit back (a viewer's today can start up to a day before now, wherever they are) to eight days on.
const BACK_MS = 26 * 3600 * 1000;
const AHEAD_MS = 8 * 24 * 3600 * 1000;

/** A season's episodes the guide could show this week, wherever the viewer is. */
export function weekOf(schedule: SeasonSchedule | undefined, now = new Date()): WeekEpisode[] {
  const from = now.getTime() - BACK_MS;
  const to = now.getTime() + AHEAD_MS;
  const out: WeekEpisode[] = [];
  for (const e of schedule?.episodes ?? []) {
    if (!e.airAt) continue;
    const at = Date.parse(e.airAt);
    // Still on at the window's start counts (a late show from last night).
    if (at + (e.runtimeMin ?? DEFAULT_RUNTIME_MIN) * 60_000 < from || at > to) continue;
    out.push({ number: e.number, airAt: e.airAt, runtimeMin: e.runtimeMin });
  }
  return out;
}

export interface HiddenShow {
  /** A show here, or null for a TV listing nobody has made a show of (part 2). */
  showId: string | null;
  tvmazeId: number | null;
  name: string;
}

/** What someone has hidden from their guide, newest first. */
export async function hiddenFor(userId: string): Promise<HiddenShow[]> {
  const { rows } = await pool.query(
    `SELECT show_id AS "showId", tvmaze_id AS "tvmazeId", name FROM guide_hidden WHERE user_id = $1 ORDER BY hidden_at DESC`,
    [userId]
  );
  return rows;
}

/** Whether you follow or play any season of this show: then it's yours, and stays on your guide. */
async function isYours(userId: string, showId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM show_follows f JOIN show_seasons ss ON ss.id = f.season_id
      WHERE f.user_id = $1 AND ss.show_id = $2 AND f.following
     UNION ALL
     SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
      WHERE m.user_id = $1 AND s.id = $2 AND l.deleted_at IS NULL
     LIMIT 1`,
    [userId, showId]
  );
  return rows.length > 0;
}

type ShowRow = { id: string; name: string; tvmaze_id: number | null };

/** The show here a request means: by one of its seasons, by itself, or by its listing (null: a listing nobody has made a show of). */
async function showOf(body: { seasonId?: unknown; showId?: unknown; tvmazeId?: unknown }): Promise<ShowRow | null> {
  const one = async (sql: string, arg: unknown) => ((await pool.query(sql, [arg])).rows[0] as ShowRow | undefined) ?? null;
  if (typeof body.seasonId === "string") {
    const show = isUuid(body.seasonId) ? await one("SELECT s.id, s.name, s.tvmaze_id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", body.seasonId) : null;
    if (!show) throw new HttpError(404, "Season not found");
    return show;
  }
  if (typeof body.showId === "string") {
    const show = isUuid(body.showId) ? await one("SELECT id, name, tvmaze_id FROM shows WHERE id = $1", body.showId) : null;
    if (!show) throw new HttpError(404, "Show not found");
    return show;
  }
  if (Number.isInteger(body.tvmazeId) && (body.tvmazeId as number) > 0) return one("SELECT id, name, tvmaze_id FROM shows WHERE tvmaze_id = $1", body.tvmazeId);
  throw new HttpError(400, "Which show? A season or show here, or a TV listing");
}

/**
 * Hide a show from your guide, or bring it back (POST /api/me/guide/hidden): `{ seasonId | showId, hidden }` for a show here
 * (every season of it, and the same show in the listings), or `{ tvmazeId, name, hidden }` for a TV listing (a listing that's
 * a show here is that show). Your own shows can't be hidden (409). Returns what's hidden now.
 */
export async function setHidden(
  userId: string,
  body: { seasonId?: unknown; showId?: unknown; tvmazeId?: unknown; name?: unknown; hidden?: unknown }
): Promise<HiddenShow[]> {
  if (typeof body.hidden !== "boolean") throw new HttpError(400, "hidden must be true or false");
  const show = await showOf(body);
  if (show) {
    if (body.hidden) {
      if (await isYours(userId, show.id)) throw new HttpError(409, "Your own shows stay on your guide");
      await pool.query(
        `INSERT INTO guide_hidden (user_id, show_id, tvmaze_id, name) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, show_id) WHERE show_id IS NOT NULL DO UPDATE SET hidden_at = now()`,
        [userId, show.id, show.tvmaze_id, show.name]
      );
    } else {
      await pool.query("DELETE FROM guide_hidden WHERE user_id = $1 AND (show_id = $2 OR (show_id IS NULL AND tvmaze_id = $3))", [userId, show.id, show.tvmaze_id]);
    }
    return hiddenFor(userId);
  }
  const tvmazeId = body.tvmazeId as number;
  if (body.hidden) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) throw new HttpError(400, "Which show? (its name)");
    await pool.query(
      `INSERT INTO guide_hidden (user_id, tvmaze_id, name) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, tvmaze_id) WHERE show_id IS NULL DO UPDATE SET hidden_at = now()`,
      [userId, tvmazeId, name]
    );
  } else {
    await pool.query("DELETE FROM guide_hidden WHERE user_id = $1 AND tvmaze_id = $2", [userId, tvmazeId]);
  }
  return hiddenFor(userId);
}
