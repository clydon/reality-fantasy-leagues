import { pool, HttpError } from "./db";
import { isSuperAdminUser, type SessionUser } from "./auth-helpers";

// A couch's own pictures (docs/PLAN-team-logos.md L4; db/migrations/0450): a picture someone on the couch set for a team, shown only
// to that couch's members in place of our badge (src/lib/sports/team-badge.ts). The app never supplies one. Each is a finished
// 256 by 256 square, so every place a team's photo shows draws it as it is.
//
// Which picture you see for a team: one set on a couch you're on. When two of your couches set the same team, the one the hub
// shows (user_settings.hub_couch) wins, then the newest. (A recommendation for the design round to confirm: the plan's "Next".)

export const COUCH_PICTURE_MAX = 100 * 1024;
const TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
const KEY = /^team:[a-z0-9-]+\/[a-z0-9.-]+:[A-Za-z0-9_-]{1,40}$/;

/** A team's key, as the sports provider names it ("team:football/nfl:12"). */
export const teamKey = (league: string, teamId: string) => `team:${league}:${teamId}`;
export const isPictureKey = (key: string) => KEY.test(key);

/** Set (or replace) a couch's picture: a finished square, already checked. Answers its version. */
export async function setCouchPicture(
  couchId: string,
  key: string,
  picture: { bytes: Buffer; type: string },
  setBy: string,
  source: "upload" | "load"
): Promise<number> {
  if (!isPictureKey(key)) throw new HttpError(400, "Say which team");
  if (!TYPES.has(picture.type)) throw new HttpError(415, "That kind of picture isn't one we keep");
  if (!picture.bytes.length || picture.bytes.length > COUCH_PICTURE_MAX) throw new HttpError(413, "That picture is too big. Try another.");
  const { rows } = await pool.query(
    `INSERT INTO couch_pictures (couch_id, key, picture, type, set_by, source) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (couch_id, key) DO UPDATE SET picture = EXCLUDED.picture, type = EXCLUDED.type, set_by = EXCLUDED.set_by,
       source = EXCLUDED.source, set_at = now(), version = couch_pictures.version + 1
     RETURNING version`,
    [couchId, key, picture.bytes, picture.type, setBy, source]
  );
  return rows[0].version as number;
}

/** Take a couch's picture away (its badge shows again). */
export async function removeCouchPicture(couchId: string, key: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM couch_pictures WHERE couch_id = $1 AND key = $2", [couchId, key]);
  return !!rowCount;
}

/** One couch's picture, for someone on that couch (or a super-admin: the desk's takedown). Null when it isn't theirs to see. */
export async function couchPictureOf(viewer: SessionUser, couchId: string, key: string): Promise<{ bytes: Buffer; type: string } | null> {
  const { rows } = await pool.query(
    `SELECT p.picture, p.type FROM couch_pictures p
      WHERE p.couch_id = $1 AND p.key = $2
        AND ($4 OR EXISTS (SELECT 1 FROM couch_members m WHERE m.couch_id = p.couch_id AND m.user_id = $3))`,
    [couchId, key, viewer.id, isSuperAdminUser(viewer)]
  );
  return rows[0] ? { bytes: rows[0].picture as Buffer, type: rows[0].type as string } : null;
}

/** Your team pictures: each team's key to its picture's link (with its version, so a browser keeps it for good). */
export async function yourTeamPictures(viewerId: string): Promise<Record<string, string>> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.key) p.key, p.couch_id, p.version
       FROM couch_pictures p
       JOIN couch_members m ON m.couch_id = p.couch_id AND m.user_id = $1
       LEFT JOIN user_settings s ON s.user_id = $1
      WHERE p.key LIKE 'team:%'
      ORDER BY p.key, (p.couch_id = s.hub_couch) DESC NULLS LAST, p.set_at DESC`,
    [viewerId]
  );
  return Object.fromEntries(rows.map((r) => [r.key as string, `/api/couches/${r.couch_id}/pictures?key=${encodeURIComponent(r.key as string)}&v=${r.version}`]));
}
