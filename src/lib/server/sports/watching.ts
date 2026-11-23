import type { SessionUser } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { requireCouch } from "../couches";
import { switchOn } from "../guard";

// I'm watching, for sports (docs/PLAN-sports-couch.md C2; migration 0451): who on a couch says they're watching a game right now.
// Presence, as a show's watch along is: only that couch sees it, and only from someone sharing When I'm watching (Settings, What your
// couch sees: share_where); you always see your own. The last day's marks only (a game's are shown while it's on: the page decides).
//
//   GET  /api/sports/watching?couch=&league=   [{ game, userId, name }]
//   POST /api/sports/watching?couch=           { league, game, on }

export interface Watching {
  game: string;
  userId: string;
  name: string;
}

const LEAGUE = /^[a-z0-9-]+\/[a-z0-9.-]+$/;
const ID = /^[\w.-]{1,40}$/;

export async function couchWatching(viewer: SessionUser, couchId: string, league: string): Promise<Watching[]> {
  if (!LEAGUE.test(league)) throw new HttpError(400, "Say which league");
  await requireCouch(viewer, couchId);
  const { rows } = await pool.query(
    `SELECT w.game_id, w.user_id, COALESCE(u.username, u.name) AS who
       FROM sports_watching w JOIN "user" u ON u.id = w.user_id
       JOIN couch_members m ON m.couch_id = w.couch_id AND m.user_id = w.user_id
      WHERE w.couch_id = $1 AND w.league = $2 AND w.created_at > now() - interval '1 day'
        AND (w.user_id = $3 OR ${switchOn("now", "w.user_id")})
      ORDER BY w.created_at`,
    [couchId, league, viewer.id]
  );
  return rows.map((r) => ({ game: r.game_id, userId: r.user_id, name: r.who }));
}

export async function setWatching(user: SessionUser, couchId: string, body: Record<string, unknown>): Promise<Watching[]> {
  const league = typeof body.league === "string" ? body.league.toLowerCase() : "";
  const game = typeof body.game === "string" ? body.game : "";
  if (!LEAGUE.test(league) || !ID.test(game)) throw new HttpError(400, "Which game? { league, game, on }");
  await requireCouch(user, couchId);
  if (body.on === false) await pool.query("DELETE FROM sports_watching WHERE couch_id = $1 AND game_id = $2 AND user_id = $3", [couchId, game, user.id]);
  else
    await pool.query(
      `INSERT INTO sports_watching (couch_id, game_id, user_id, league) VALUES ($1, $2, $3, $4)
       ON CONFLICT (couch_id, game_id, user_id) DO UPDATE SET created_at = now()`,
      [couchId, game, user.id, league]
    );
  return couchWatching(user, couchId, league);
}
