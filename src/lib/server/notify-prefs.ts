import { CHAT_CHOICES, chatMode, MOMENTS, momentOn, momentOf, mutedNow, showOffSet, type ChatMode, type MomentId } from "@/lib/moments";
import { cardArtSql } from "./art-sql";
import { pool, HttpError } from "./db";
import { seenThroughAll } from "./guard";
import { isUuid } from "./auth-helpers";
import { seasonSchedules } from "./schedule";

// Notifications by moment, the settings and the bell (docs/PLAN-new-design.md step 15 part 2; the mock's settings.js "What we
// notify you about", index.html notesSheet and show.js showMenu's Notifications):
//   - Your moments (Settings): each of moments.js's on or off (its notification types in notification_prefs.disabled, the
//     switches classic's Account settings has always written), and Couch chat's choice (notification_prefs.chat).
//   - A show's own (its ⋯ menu): the moments turned off for that show alone (notification_prefs.shows), and muting it, for a day,
//     a week or until you turn it back on (notification_prefs.muted, settings Round 1: A6).
//   - A couch's own chat choice (couch_members.chat_notify, A9), over your account's.
//   - What you've set on a show or a couch, gathered for Your settings (`elsewhere`), so "where did I turn that off?" has one
//     answer.
//   - The bell: what's happened, kept per person (the `notifications` table push-core.js writes), read back through the guard,
//     and when you last looked (user_settings.notes_read_at): its count rides on the home read, never polled.
//   - Your time zone, kept from your phone (user_settings.tz), so a push says your time.

/** A show where you've set something of its own: muted (until an ISO time, or "forever"), or some kinds off. */
export interface ShowException {
  showId: string;
  /** "Survivor" (a show's notifications cover every season of it). */
  show: string;
  /** The season to open it on: the latest of it you follow, else null. */
  seasonId: string | null;
  muted: string | null;
  off: MomentId[];
}

/** A couch whose chat you've set apart from your account's choice. */
export interface CouchException {
  couchId: string;
  name: string;
  chat: ChatMode;
}

export interface NotifySettings {
  moments: Record<Exclude<MomentId, "chat">, boolean>;
  chat: ChatMode;
  /** How many devices you've turned notifications on for (this one's own state is the browser's). */
  devices: number;
  /** What you've set on a show or a couch (Your settings lists them, each a link). */
  elsewhere: { shows: ShowException[]; couches: CouchException[] };
}

const isChat = (x: unknown): x is ChatMode => x === "all" || x === "quiet" || x === "off";

/** Your moments, Couch chat's choice and what you've set elsewhere (the profile read's `notify`). */
export async function readNotify(userId: string): Promise<NotifySettings> {
  const [{ rows }, { rows: couches }] = await Promise.all([
    pool.query(
      `SELECT p.disabled, p.chat, p.shows, p.muted, (SELECT count(*)::int FROM push_subscriptions s WHERE s.user_id = $1) AS devices
         FROM (SELECT 1) one LEFT JOIN notification_prefs p ON p.user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT c.id, c.name, cm.chat_notify FROM couch_members cm JOIN couches c ON c.id = cm.couch_id
        WHERE cm.user_id = $1 AND cm.chat_notify IS NOT NULL ORDER BY c.name`,
      [userId]
    ),
  ]);
  const disabled = (rows[0]?.disabled as Record<string, boolean> | null) ?? {};
  const moments = Object.fromEntries(MOMENTS.filter((m) => m.id !== "chat").map((m) => [m.id, momentOn(m.id, disabled)])) as NotifySettings["moments"];
  return {
    moments,
    chat: chatMode(disabled, rows[0]?.chat),
    devices: rows[0]?.devices ?? 0,
    elsewhere: {
      shows: await showExceptions(userId, (rows[0]?.shows as Record<string, unknown> | null) ?? {}, (rows[0]?.muted as Record<string, string> | null) ?? {}),
      couches: couches.filter((c) => isChat(c.chat_notify)).map((c) => ({ couchId: c.id, name: c.name, chat: c.chat_notify as ChatMode })),
    },
  };
}

/** The shows you've muted (still muted now) or turned kinds off for, named, each with the season of it you follow latest. */
async function showExceptions(userId: string, shows: Record<string, unknown>, muted: Record<string, string>): Promise<ShowException[]> {
  const ids = [...new Set([...Object.keys(shows), ...Object.keys(muted)])].filter(isUuid);
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT s.id, s.name,
            (SELECT ss.id FROM show_follows f JOIN show_seasons ss ON ss.id = f.season_id
              WHERE f.user_id = $1 AND f.following AND ss.show_id = s.id ORDER BY ss.premiere_date DESC NULLS LAST, ss.season_number DESC NULLS LAST LIMIT 1) AS season_id
       FROM shows s WHERE s.id = ANY($2::uuid[]) ORDER BY s.name`,
    [userId, ids]
  );
  return rows
    .map((r) => {
      const off = [...showOffSet(shows[r.id])].filter((m): m is MomentId => MOMENTS.some((x) => x.id === m && x.perShow));
      const until = mutedNow(muted[r.id]) ? muted[r.id] : null;
      return { showId: r.id as string, show: (r.name as string).replace(/\s*\([^)]*\)\s*$/, ""), seasonId: (r.season_id as string | null) ?? null, muted: until, off };
    })
    .filter((x) => x.muted || x.off.length);
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
  const m = MOMENTS.find((x) => x.id === body.moment && x.id !== "chat" && !x.fixed);
  if (!m) throw new HttpError(400, "Which moment?");
  if (typeof body.on !== "boolean") throw new HttpError(400, "on must be true or false");
  await setTypes(userId, m.types, body.on);
}

export interface ShowNotify {
  showId: string;
  /** "Survivor": what the sheet is about (a show's switches cover every season of it). */
  show: string;
  /** Muted until this ISO time, or "forever"; null when it isn't (or a mute has run out). */
  muted: string | null;
  moments: { id: MomentId; title: string; line: string; on: boolean; here: boolean }[];
}

/** How long a mute lasts, from now. */
export type MuteFor = "day" | "week" | "forever";

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
  const [notify, { rows }] = await Promise.all([
    readNotify(userId),
    pool.query("SELECT shows -> $2 AS off, muted ->> $2 AS muted FROM notification_prefs WHERE user_id = $1", [userId, show.id]),
  ]);
  const off = showOffSet(rows[0]?.off);
  return {
    showId: show.id,
    show: show.name,
    muted: mutedNow(rows[0]?.muted) ? (rows[0].muted as string) : null,
    moments: MOMENTS.filter((m) => m.perShow).map((m) => ({
      id: m.id,
      title: m.title,
      // Couch chat here is on or off; how much of it is your account's choice (or a couch's own).
      line: m.id === "chat" ? `${CHAT_CHOICES.find((c) => c.id === notify.chat)?.title ?? "Skip possible spoilers"} is your choice for every couch` : m.line,
      on: m.id === "chat" ? notify.chat !== "off" : notify.moments[m.id as Exclude<MomentId, "chat">],
      here: !off.has(m.id),
    })),
  };
}

/** Mutes a show for a day, a week or until it's turned back on, or unmutes it (`null`) (PUT /api/seasons/[id]/notifications { mute }). */
export async function muteShow(userId: string, seasonId: string, mute: unknown): Promise<ShowNotify> {
  const show = await showOf(seasonId);
  if (mute !== null && mute !== "day" && mute !== "week" && mute !== "forever") throw new HttpError(400, "mute must be day, week, forever or null");
  // It ends on the hour after a day or a week from now: a minute is noise on a mute (settings Round 1's check).
  const until = mute === "forever" ? "forever" : mute ? new Date(Math.ceil((Date.now() + (mute === "day" ? 1 : 7) * 86_400_000) / 3_600_000) * 3_600_000).toISOString() : null;
  if (until) {
    await pool.query(
      `INSERT INTO notification_prefs (user_id, muted) VALUES ($1, jsonb_build_object($2::text, $3::text))
       ON CONFLICT (user_id) DO UPDATE SET muted = notification_prefs.muted || jsonb_build_object($2::text, $3::text), updated_at = now()`,
      [userId, show.id, until]
    );
  } else {
    await pool.query("UPDATE notification_prefs SET muted = muted - $2, updated_at = now() WHERE user_id = $1", [userId, show.id]);
  }
  return readShowNotify(userId, seasonId);
}

/** Puts a mute back exactly as it was (Undo): an ISO end, "forever", or none. */
export async function restoreMute(userId: string, seasonId: string, until: unknown): Promise<ShowNotify> {
  const show = await showOf(seasonId);
  if (until !== null && until !== "forever" && !(typeof until === "string" && Number.isFinite(Date.parse(until)))) throw new HttpError(400, "until must be a time, forever or null");
  if (until === null) return muteShow(userId, seasonId, null);
  await pool.query(
    `INSERT INTO notification_prefs (user_id, muted) VALUES ($1, jsonb_build_object($2::text, $3::text))
     ON CONFLICT (user_id) DO UPDATE SET muted = notification_prefs.muted || jsonb_build_object($2::text, $3::text), updated_at = now()`,
    [userId, show.id, until]
  );
  return readShowNotify(userId, seasonId);
}

/** Your chat choice on one couch (null: your account's) (GET /api/couches/[id]/chat-notify). */
export async function readCouchChat(userId: string, couchId: string): Promise<{ chat: ChatMode | null }> {
  if (!isUuid(couchId)) throw new HttpError(404, "Couch not found");
  const { rows } = await pool.query("SELECT chat_notify FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couchId, userId]);
  if (!rows.length) throw new HttpError(404, "Couch not found");
  return { chat: isChat(rows[0].chat_notify) ? rows[0].chat_notify : null };
}

/** Sets your chat choice on one couch, or back to your account's (`null`) (PUT /api/couches/[id]/chat-notify { chat }). */
export async function saveCouchChat(userId: string, couchId: string, chat: unknown): Promise<{ chat: ChatMode | null }> {
  if (chat !== null && !isChat(chat)) throw new HttpError(400, "chat must be all, quiet, off or null");
  if (!isUuid(couchId)) throw new HttpError(404, "Couch not found");
  const { rowCount } = await pool.query("UPDATE couch_members SET chat_notify = $3 WHERE couch_id = $1 AND user_id = $2", [couchId, userId, chat]);
  if (!rowCount) throw new HttpError(404, "Couch not found");
  return { chat: chat as ChatMode | null };
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
  /** The show's art (the bell no longer draws it on every row: step 8; kept for other readers). */
  art: string | null;
  /** Its push type (push-core.js NOTIFICATION_TYPES), for the row's icon. */
  type: string;
  /** It asks you to decide something (a join request): it leads the new ones. */
  needs: boolean;
}

/** Push types that ask the reader to decide something, so the bell puts them first among the new. */
const NEEDS = new Set(["joinRequest"]);

/**
 * Whether a reminder still holds (the design round's step 8: an instruction for a moment that's gone is noise). Its key says what
 * it's about (db/reminders.js and backstage-remind.ts: `remind:<season>:<episode>:before|aired:<window>`; waiver-pushes.js:
 * `wremind:<league>:<week>:<claims due, ms>`): a "before" one goes once that episode has aired or you've watched it, an "aired" one
 * once you've watched it, a waiver one once its claims were due. Anything else always holds.
 */
export function reminderHolds(key: string | null, seen: (seasonId: string) => number, airedAt: (seasonId: string, n: number) => number | null, now = Date.now()): boolean {
  if (!key) return true;
  const w = /^wremind:[^:]+:[^:]+:(\d+)$/.exec(key);
  if (w) return now < Number(w[1]);
  const r = /^remind:([^:]+):(\d+):(before|aired):/.exec(key);
  if (!r) return true;
  const n = Number(r[2]);
  if (n && seen(r[1]) >= n) return false;
  if (r[3] === "before") {
    const at = airedAt(r[1], n);
    if (at !== null && at <= now) return false;
  }
  return true;
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
      `SELECT n.id, n.type, n.key, n.title, n.body, n.link, n.created_at, n.season_id, n.spoils, n.safe, ${cardArtSql()} AS art_url
         FROM notifications n LEFT JOIN show_seasons ss ON ss.id = n.season_id LEFT JOIN shows s ON s.id = ss.show_id
        WHERE n.user_id = $1 AND n.created_at > now() - interval '${NOTES_KEPT_DAYS} days'
        ORDER BY n.created_at DESC LIMIT ${NOTES_SHOWN}`,
      [userId]
    ),
    pool.query("SELECT notes_read_at FROM user_settings WHERE user_id = $1", [userId]),
    seenThroughAll(userId),
  ]);
  const readAt = (read[0]?.notes_read_at as Date | null) ?? null;
  // A reminder's episode times, only for the seasons a reminder in the list is about.
  const reminded = [...new Set(rows.map((r) => /^remind:([^:]+):/.exec(r.key ?? "")?.[1]).filter((id): id is string => !!id && isUuid(id)))];
  const schedules: Awaited<ReturnType<typeof seasonSchedules>> = reminded.length ? await seasonSchedules(reminded) : new Map();
  const airedAt = (seasonId: string, n: number) => {
    const at = schedules.get(seasonId)?.episodes.find((e) => e.number === n)?.airAt;
    return at ? Date.parse(at) : null;
  };
  const markOn = (seasonId: string) => seen.get(seasonId) ?? 0;
  return {
    readAt: readAt ? readAt.toISOString() : null,
    notes: rows.filter((r) => reminderHolds(r.key, markOn, airedAt)).map((r) => {
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
        type: r.type,
        needs: NEEDS.has(r.type),
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
