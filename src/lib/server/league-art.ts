import { pool, HttpError } from "./db";
import { isImpersonating, isSuperAdminUser, type Session, type SessionUser } from "./auth-helpers";
import { isArtChoice, isLeagueKey, UPLOAD, type LeagueArtState } from "@/lib/sports/league-art";

// A league's art for you (docs/design-round/league-art-spec.md; src/lib/sports/league-art.ts has the rule): your choices
// (user_settings.league_art), your own pictures (league_art_pictures, migration 0455), and the couch's art, so that everyone on a
// couch sees art without doing anything (the user, 2026-11-23): its owner's choice, else the first member's to choose, by when they
// joined. A picture is seen by its uploader and by anyone on a couch with them, as a face is (profile.ts pictureOf).
//
// Uploads skip the takedown and safety steps docs/PLAN-team-logos.md asks of member uploads (the user's call, 2026-11-23: "bypass
// this guardrail for now"). What's kept: the browser re-draws the picture (its metadata gone), this checks it's really a JPEG, PNG or
// WebP by its first bytes and under 400 KB, and it's only ever served to its uploader's couches, privately.

export const LEAGUE_PICTURE_MAX = 400 * 1024;

/** Your choices, your pictures, and the couch's art (a couch you're on; null for none). */
export async function readLeagueArt(viewer: SessionUser, couchId: string | null): Promise<LeagueArtState> {
  const [{ rows: s }, { rows: pics }] = await Promise.all([
    pool.query("SELECT league_art FROM user_settings WHERE user_id = $1", [viewer.id]),
    pool.query("SELECT league, version FROM league_art_pictures WHERE user_id = $1", [viewer.id]),
  ]);
  const couch: LeagueArtState["couch"] = {};
  if (couchId) {
    // The couch's art: per league, its owner's choice, else the first member's (by when they joined). A choice of a picture counts
    // only while the picture's there. Only for someone on the couch.
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (kv.key) kv.key AS league, kv.value AS art, m.user_id, COALESCE(u.username, u.name) AS name, p.version
         FROM couch_members m
         JOIN user_settings st ON st.user_id = m.user_id
         CROSS JOIN LATERAL jsonb_each_text(st.league_art) kv
         JOIN "user" u ON u.id = m.user_id
         LEFT JOIN league_art_pictures p ON p.user_id = m.user_id AND p.league = kv.key
        WHERE m.couch_id = $1
          AND EXISTS (SELECT 1 FROM couch_members me WHERE me.couch_id = $1 AND me.user_id = $2)
          AND (kv.value <> $3 OR p.version IS NOT NULL)
        ORDER BY kv.key, (m.role = 'owner') DESC, m.joined_at, m.user_id`,
      [couchId, viewer.id, UPLOAD]
    );
    for (const r of rows) couch[r.league] = { art: r.art, by: r.user_id, name: r.name, picture: r.version == null ? null : Number(r.version) };
  }
  return {
    mine: (s[0]?.league_art as Record<string, string> | undefined) ?? {},
    pictures: Object.fromEntries(pics.map((p) => [p.league as string, Number(p.version)])),
    couch,
  };
}

function mayChange(session: Session) {
  if (isImpersonating(session)) throw new HttpError(403, "You're viewing as someone. Their settings are theirs to change.");
}

/** Your choice for a league: one of its own arts, your picture (UPLOAD, when you have one), or null for none (the couch's, else its first). */
export async function setLeagueArt(session: Session, league: unknown, art: unknown): Promise<void> {
  mayChange(session);
  if (!isLeagueKey(league)) throw new HttpError(400, "Say which league");
  if (art !== null) {
    const { rows } = await pool.query("SELECT 1 FROM league_art_pictures WHERE user_id = $1 AND league = $2", [session.user.id, league]);
    if (!isArtChoice(league, art, rows.length > 0)) throw new HttpError(400, "That art isn't one this league can wear");
  }
  await pool.query("INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [session.user.id]);
  await pool.query(
    `UPDATE user_settings SET league_art = CASE WHEN $3::text IS NULL THEN league_art - $2::text ELSE league_art || jsonb_build_object($2::text, $3::text) END,
       updated_at = now() WHERE user_id = $1`,
    [session.user.id, league, art]
  );
}

/** What a picture's first bytes say it is, or null. */
function sniff(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Your picture for a league (it becomes your choice there). Answers its version. */
export async function saveLeaguePicture(session: Session, league: unknown, bytes: ArrayBuffer): Promise<number> {
  mayChange(session);
  if (!isLeagueKey(league)) throw new HttpError(400, "Say which league");
  const b = Buffer.from(bytes);
  if (!b.length) throw new HttpError(400, "No picture came through");
  if (b.length > LEAGUE_PICTURE_MAX) throw new HttpError(413, "That picture is too big. Try another.");
  const type = sniff(b);
  if (!type) throw new HttpError(415, "A picture is a JPEG, WebP or PNG");
  const version = Date.now();
  await pool.query(
    `INSERT INTO league_art_pictures (user_id, league, picture, type, version) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, league) DO UPDATE SET picture = EXCLUDED.picture, type = EXCLUDED.type, version = EXCLUDED.version`,
    [session.user.id, league, b, type, version]
  );
  await setLeagueArt(session, league, UPLOAD);
  return version;
}

/** Take your picture for a league away (and your choice of it, so you see the couch's again, else its first). */
export async function removeLeaguePicture(session: Session, league: unknown): Promise<void> {
  mayChange(session);
  if (!isLeagueKey(league)) throw new HttpError(400, "Say which league");
  await pool.query("DELETE FROM league_art_pictures WHERE user_id = $1 AND league = $2", [session.user.id, league]);
  await pool.query("UPDATE user_settings SET league_art = league_art - $2::text WHERE user_id = $1 AND league_art ->> $2::text = $3", [session.user.id, league, UPLOAD]);
}

/** Someone's picture for a league, for themselves, anyone on a couch with them, or a site admin; null when it isn't theirs to see. */
export async function leaguePictureOf(viewer: SessionUser, userId: string, league: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!isLeagueKey(league)) return null;
  const { rows } = await pool.query(
    `SELECT p.picture, p.type FROM league_art_pictures p
      WHERE p.user_id = $1 AND p.league = $4
        AND ($1 = $2 OR $3 OR EXISTS (SELECT 1 FROM couch_members a JOIN couch_members b ON b.couch_id = a.couch_id WHERE a.user_id = $2 AND b.user_id = $1))`,
    [userId, viewer.id, isSuperAdminUser(viewer), league]
  );
  return rows[0] ? { bytes: rows[0].picture as Buffer, type: rows[0].type as string } : null;
}
