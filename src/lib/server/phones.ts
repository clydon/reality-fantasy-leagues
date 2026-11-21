import { pool, HttpError } from "./db";
import { isImpersonating, type Session } from "./auth-helpers";

// Your phones (settings Round 1, A3; docs/design-round/settings-r1-spec.md): the phones and computers that get your notifications
// (push_subscriptions, a row each, named from the browser that turned them on), the places you're signed in (Better Auth's
// session rows, never one a site admin opened as you), turning one phone's notifications off, and signing out everywhere else,
// which also stops every other phone's notifications (a signed-out phone mustn't keep getting your pushes: BACKLOG 232's rule).

export interface PhoneRow {
  id: string;
  /** "iPhone · Safari", from its browser's own words: nothing is stored to name it. */
  name: string;
  /** This phone (the one asking). */
  here: boolean;
  /** When a notification last reached it, or when it was turned on; ISO. */
  at: string | null;
  /** Never reached (no notification has gone to it yet). */
  fresh?: boolean;
}

/** A device's plain name from its user agent: the kind of device, then its browser. */
export function deviceName(ua: string | null | undefined): string {
  const s = ua ?? "";
  const device = /iPhone/.test(s)
    ? "iPhone"
    : /iPad/.test(s)
      ? "iPad"
      : /Android/.test(s)
        ? /Mobile/.test(s)
          ? "Android phone"
          : "Android tablet"
        : /Macintosh|Mac OS X/.test(s)
          ? "Mac"
          : /Windows/.test(s)
            ? "Windows computer"
            : /CrOS/.test(s)
              ? "Chromebook"
              : /Linux/.test(s)
                ? "Linux computer"
                : "A device";
  const browser = /EdgA?\//.test(s)
    ? "Edge"
    : /SamsungBrowser/.test(s)
      ? "Samsung Internet"
      : /Firefox|FxiOS/.test(s)
        ? "Firefox"
        : /CriOS|Chrome\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : null;
  return browser ? `${device} · ${browser}` : device;
}

/** Your phones (GET /api/me/phones?here=<this phone's push endpoint>). */
export async function readPhones(session: Session, here: string | null): Promise<{ notify: PhoneRow[]; signedIn: PhoneRow[] }> {
  const userId = session.user.id;
  const [{ rows: subs }, { rows: sessions }] = await Promise.all([
    pool.query(
      "SELECT id, endpoint, user_agent, created_at, last_success_at FROM push_subscriptions WHERE user_id = $1 ORDER BY COALESCE(last_success_at, created_at) DESC",
      [userId]
    ),
    pool.query(
      `SELECT id, "userAgent" AS ua, "updatedAt" AS at FROM session
        WHERE "userId" = $1 AND "expiresAt" > now() AND "impersonatedBy" IS NULL ORDER BY "updatedAt" DESC`,
      [userId]
    ),
  ]);
  return {
    notify: subs.map((r) => ({
      id: r.id as string,
      name: deviceName(r.user_agent),
      here: !!here && r.endpoint === here,
      at: new Date(r.last_success_at ?? r.created_at).toISOString(),
      fresh: !r.last_success_at,
    })),
    // Each sign-in is a row of its own, so one browser signed into again and again would list over and over: one row a device and
    // browser, this one marked, with when it was last used.
    signedIn: [
      ...sessions
        .map((r) => ({ id: r.id as string, name: deviceName(r.ua), here: r.id === session.session.id, at: new Date(r.at).toISOString() }))
        .reduce((by, r) => {
          const was = by.get(r.name);
          if (!was) by.set(r.name, r);
          else by.set(r.name, { ...was, here: was.here || r.here, id: was.here ? was.id : r.here ? r.id : was.id });
          return by;
        }, new Map<string, PhoneRow>())
        .values(),
    ],
  };
}

function mayChange(session: Session) {
  if (isImpersonating(session)) throw new HttpError(403, "You're viewing as someone. Their phones are theirs to change.");
}

/** Turns one phone's notifications off (DELETE /api/me/phones { id }): only your own. */
export async function turnOffPhone(session: Session, id: unknown): Promise<void> {
  mayChange(session);
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Which phone?");
  await pool.query("DELETE FROM push_subscriptions WHERE id = $1 AND user_id = $2", [id, session.user.id]);
}

/**
 * Signs you out everywhere but here (POST /api/me/phones { signOutOthers: true, here }), and stops every other phone's notifications
 * (a phone that's signed out mustn't keep ringing with yours). Answers how many places it signed out.
 */
export async function signOutOthers(session: Session, here: unknown): Promise<number> {
  mayChange(session);
  const userId = session.user.id;
  const { rowCount } = await pool.query(`DELETE FROM session WHERE "userId" = $1 AND id <> $2 AND "impersonatedBy" IS NULL`, [userId, session.session.id]);
  await pool.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint IS DISTINCT FROM $2", [userId, typeof here === "string" ? here : null]);
  return rowCount ?? 0;
}
