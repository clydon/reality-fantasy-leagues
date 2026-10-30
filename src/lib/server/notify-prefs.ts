import { CHAT_CHOICES, chatMode, MOMENTS, momentOn, momentOf, type ChatMode, type MomentId } from "@/lib/moments";
import { cardArtSql } from "./art-sql";
import { pool, HttpError } from "./db";
import { seenThroughAll } from "./guard";
import { isUuid } from "./auth-helpers";

// Notifications by moment, the settings and the bell (docs/PLAN-new-design.md step 15 part 2; the mock's settings.js "What we
// notify you about", index.html notesSheet and show.js showMenu's Notifications):
//   - Your moments (Settings): each of moments.js's on or off (its notification types in notification_prefs.disabled, the
//     switches classic's Account settings has always written), and Couch chat's choice (notification_prefs.chat).
//   - A show's own (its ⋯ menu): the moments turned off for that show alone (notification_prefs.shows).
//   - The bell: what's happened, kept per person (the `notifications` table push-core.js writes), read back through the guard,
//     and when you last looked (user_settings.notes_read_at): its count rides on the home read, never polled.
//   - Your time zone, kept from your phone (user_settings.tz), so a push says your time.

export interface NotifySettings {
  moments: Record<MomentId, boolean>;
  chat: ChatMode;
  /** How many devices you've turned notifications on for (this one's own state is the browser's). */
  devices: number;
}

/** Your moments and Couch chat's choice (the profile read's `notify`). */
export async function readNotify(userId: string): Promise<NotifySettings> {
  const { rows } = await pool.query(
    `SELECT p.disabled, p.chat, (SELECT count(*)::int FROM push_subscriptions s WHERE s.user_id = $1) AS devices
       FROM (SELECT 1) one LEFT JOIN notification_prefs p ON p.user_id = $1`,
    [userId]
  );
  const disabled = (rows[0]?.disabled as Record<string, boolean> | null) ?? {};
  const moments = Object.fromEntries(MOMENTS.filter((m) => m.id !== "chat").map((m) => [m.id, momentOn(m.id, disabled)])) as Record<MomentId, boolean>;
  return { moments, chat: chatMode(disabled, rows[0]?.chat), devices: rows[0]?.devices ?? 0 };
}

/** Writes a set of types on or off in notification_prefs.disabled (stored inverted: only what's off is kept). */
async function setTypes(userId: string, types: string[], on: boolean) {
  const off = on ? {} : Object.fromEntries(types.map((t) => [t, true]));
  await pool.query(
    `INSERT INTO notification_prefs (user_id, disabled) VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET disabled = (notification_prefs.disabled || $2::jsonb) - $3::text[], updated_at = now()`,
    [userId, JSON.stringify(off), on ? types : []]
  );
}

/** A moment on or off (all of its types), or Couch chat's choice (PUT /api/me/profile { notify }). */
export async function saveNotify(userId: string, body: { moment?: unknown; on?: unknown; chat?: unknown }): Promise<void> {
  if (body.chat !== undefined) {
    if (!CHAT_CHOICES.some((c) => c.id === body.chat)) throw new HttpError(400, "chat must be all, quiet or off");
    await setTypes(userId, ["chat"], body.chat !== "off");
    if (body.chat !== "off") await pool.query("UPDATE notification_prefs SET chat = $2, updated_at = now() WHERE user_id = $1", [userId, body.chat === "all" ? "all" : null]);
    return;
  }
  const m = MOMENTS.find((x) => x.id === body.moment && x.id !== "chat");
  if (!m) throw new HttpError(400, "Which moment?");
  if (typeof body.on !== "boolean") throw new HttpError(400, "on must be true or false");
  await setTypes(userId, m.types, body.on);
}

export interface ShowNotify {
  showId: string;
  /** "Survivor": what the sheet is about (a show's switches cover every season of it). */
  show: string;
  moments: { id: MomentId; title: string; line: string; on: boolean; here: boolean }[];
}

async function showOf(seasonId: string): Promise<{ id: string; name: string }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT s.id, s.name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  return { id: rows[0].id, name: (rows[0].name as string).replace(/\s*\([^)]*\)\s*$/, "") };
}

/**
 * A show's Notifications (its ⋯ menu; GET /api/seasons/[id]/notifications): each moment a show can have, whether it's on for you
 * at all (`on`, Settings) and for this show (`here`). Couch chat here is on or off; its Every message / Quiet is yours everywhere.
 */
export async function readShowNotify(userId: string, seasonId: string): Promise<ShowNotify> {
  const show = await showOf(seasonId);
  const [notify, { rows }] = await Promise.all([readNotify(userId), pool.query("SELECT shows -> $2 AS off FROM notification_prefs WHERE user_id = $1", [userId, show.id])]);
  const off = new Set<string>(Array.isArray(rows[0]?.off) ? rows[0].off : []);
  return {
    showId: show.id,
    show: show.name,
    moments: MOMENTS.filter((m) => m.perShow).map((m) => ({
      id: m.id,
      title: m.title,
      // Couch chat here is on or off; how much of it is yours everywhere (Settings' choice).
      line: m.id === "chat" ? `${CHAT_CHOICES.find((c) => c.id === notify.chat)?.title ?? "Quiet on episode nights"} for every show, in Settings` : m.line,
      on: m.id === "chat" ? notify.chat !== "off" : notify.moments[m.id],
      here: !off.has(m.id),
    })),
  };
}

/** One of a show's moments on or off for that show alone (PUT /api/seasons/[id]/notifications { moment, on }). */
export async function saveShowNotify(userId: string, seasonId: string, body: { moment?: unknown; on?: unknown }): Promise<ShowNotify> {
  const show = await showOf(seasonId);
  const m = MOMENTS.find((x) => x.id === body.moment && x.perShow);
  if (!m) throw new HttpError(400, "Which moment?");
  if (typeof body.on !== "boolean") throw new HttpError(400, "on must be true or false");
  await pool.query(
    `INSERT INTO notification_prefs (user_id, shows) VALUES ($1, jsonb_build_object($2::text, CASE WHEN $4 THEN '[]'::jsonb ELSE jsonb_build_array($3::text) END))
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now(), shows = CASE
       WHEN $4 THEN jsonb_set(notification_prefs.shows, ARRAY[$2::text], COALESCE(notification_prefs.shows -> $2, '[]'::jsonb) - $3::text)
       ELSE jsonb_set(notification_prefs.shows, ARRAY[$2::text], (COALESCE(notification_prefs.shows -> $2, '[]'::jsonb) - $3::text) || jsonb_build_array($3::text))
     END`,
    [userId, show.id, m.id, body.on]
  );
  // Nothing turned off for a show: no key left for it.
  await pool.query("UPDATE notification_prefs SET shows = shows - $2 WHERE user_id = $1 AND shows -> $2 = '[]'::jsonb", [userId, show.id]);
  return readShowNotify(userId, seasonId);
}

// ---------- the bell ----------

export interface Note {
  id: string;
  /** Its moment (moments.js), for the row's icon. */
  moment: MomentId | null;
  title: string;
  body: string;
  /** Where tapping it goes. */
  link: string;
  at: string;
  /** Newer than when you last looked. */
  unread: boolean;
  seasonId: string | null;
  /** The show's art, for the row. */
  art: string | null;
}

/** How long the bell keeps a notice (push-core.js takes older ones away as it writes newer ones). */
export const NOTES_KEPT_DAYS = 30;
const NOTES_SHOWN = 50;

/**
 * The bell (GET /api/me/notifications): your notices, newest first, each as the guard lets it out now: one whose words give
 * away an episode you're not past (you moved where you are back, or turned Hide scores on since) reads as its safe words.
 */
export async function readNotes(userId: string): Promise<{ notes: Note[]; readAt: string | null }> {
  const [{ rows }, { rows: read }, seen] = await Promise.all([
    pool.query(
      `SELECT n.id, n.type, n.title, n.body, n.link, n.created_at, n.season_id, n.spoils, n.safe, ${cardArtSql()} AS art_url
         FROM notifications n LEFT JOIN show_seasons ss ON ss.id = n.season_id LEFT JOIN shows s ON s.id = ss.show_id
        WHERE n.user_id = $1 AND n.created_at > now() - interval '${NOTES_KEPT_DAYS} days'
        ORDER BY n.created_at DESC LIMIT ${NOTES_SHOWN}`,
      [userId]
    ),
    pool.query("SELECT notes_read_at FROM user_settings WHERE user_id = $1", [userId]),
    seenThroughAll(userId),
  ]);
  const readAt = (read[0]?.notes_read_at as Date | null) ?? null;
  return {
    readAt: readAt ? readAt.toISOString() : null,
    notes: rows.map((r) => {
      const past = Number.isInteger(r.spoils) && (!r.season_id || (seen.get(r.season_id) ?? 0) < r.spoils);
      const words = past ? ((r.safe as { title: string; body: string } | null) ?? { title: "Results are in", body: "Reveal when you've watched." }) : { title: r.title, body: r.body };
      return {
        id: r.id,
        moment: momentOf(r.type),
        title: words.title,
        body: words.body,
        link: r.link,
        at: new Date(r.created_at).toISOString(),
        unread: !readAt || new Date(r.created_at) > readAt,
        seasonId: r.season_id,
        art: r.art_url ?? null,
      };
    }),
  };
}

/** You've looked (POST /api/me/notifications { read }): the count starts again from now. */
export async function markNotesRead(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_settings (user_id, notes_read_at) VALUES ($1, now())
     ON CONFLICT (user_id) DO UPDATE SET notes_read_at = now(), updated_at = now()`,
    [userId]
  );
}

/** How many notices are newer than when you last looked (the home read's `notes`). */
export async function unreadNotes(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM notifications
      WHERE user_id = $1 AND created_at > GREATEST(now() - interval '${NOTES_KEPT_DAYS} days', COALESCE((SELECT notes_read_at FROM user_settings WHERE user_id = $1), '-infinity'))`,
    [userId]
  );
  return rows[0]?.n ?? 0;
}

// ---------- your time zone ----------

/** Whether a string is a time zone this server knows ("America/Los_Angeles"). */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Keeps the time zone your phone says (the home read's and classic's /api/me `?tz=`), so a push says your time: written only
 * when it's new or changed (a row the update leaves alone isn't written at all).
 */
export async function keepTimeZone(userId: string, tz: unknown): Promise<void> {
  if (!isTimeZone(tz)) return;
  await pool.query(
    `INSERT INTO user_settings (user_id, tz) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET tz = EXCLUDED.tz, updated_at = now() WHERE user_settings.tz IS DISTINCT FROM EXCLUDED.tz`,
    [userId, tz]
  );
}
