import { isAPIError } from "better-auth/api";
import StateLogic from "@/lib/game/state-logic.js";
import { auth } from "@/lib/auth";
import { realEmail } from "@/lib/no-email";
import { isPaletteColour } from "@/lib/people";
import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/appearance";
import { sharingFrom, SHARE_SWITCHES, type ShareSwitch, type Sharing } from "@/lib/sharing";
import { isImpersonating, isSuperAdminUser, type Session, type SessionUser } from "./auth-helpers";
import { pool, HttpError, withLeagueLock } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { leagueStates } from "./league-states";
import { sharingOf } from "./guard";
import { googleOn } from "./way-in";
import { readNotify, saveNotify, type NotifySettings } from "./notify-prefs";

// Your profile and your account settings in the new design (docs/PLAN-new-design.md step 15 part 1; the mock's settings.js):
// your name, colour and picture, Hide scores until I reveal, your AI for results, and what your account signs in with; and What
// your couch sees (step 15 part 3: the four switches, src/lib/sharing.ts, and what they let out of you, in your own words); and
// Appearance (part 4: Night, Studio or Match phone, src/lib/appearance.ts, kept on each device as a cookie: appearance.ts).
//
// One name: your username is the name your couch sees (the way in says so), and saving a new one renames your seat in every
// league you play (classic's tables and the new design's then agree) and signs your old messages with it. One face: your
// colour (src/lib/people.ts PALETTE) and your picture (user_pictures, migration 0135), which the couches' people carry on the
// home read; the picture itself is read only through GET /api/people/[id]/picture, by someone on a couch with you.

export type AiChoice = "chatgpt" | "grok" | "ask" | "copy";
export const AI_CHOICES: AiChoice[] = ["chatgpt", "grok", "ask", "copy"];

export interface Profile {
  /** The name your couch sees: your username (the account's name for an account with none). */
  name: string;
  /** The colour you chose (a PALETTE hex), else null: your face's colour comes from your id. */
  colour: string | null;
  /** Your picture's version (when it was saved, ms), else null. */
  picture: number | null;
  /** The AI the Ask an AI sheets open (null in the database: ChatGPT, the recommended one). */
  ai: AiChoice;
  /** Results wait for you to reveal them (user_settings.show_results_immediately turned round). */
  hideScores: boolean;
  /** Appearance (step 15 part 4): Night, Studio or Match phone. */
  theme: Theme;
  /** "Survivor 49": the first season you played, for the me card's "since". */
  since: string | null;
  /** What we notify you about (step 15 part 2): each moment on or off, and Couch chat's choice. */
  notify: NotifySettings;
  /** What your couch sees (step 15 part 3): the four switches, and a line each on what one lets out ("alex is on Episode 4 of
   *  Survivor 51"), from your own shows, ratings and reactions where you have any (only shows you follow openly). */
  sharing: { on: Sharing; lines: Record<ShareSwitch, string> };
  account: {
    username: string | null;
    /** Your real email (never a username-only account's stand-in). */
    email: string | null;
    /** You sign in with a password (so Change password makes sense). */
    password: boolean;
    /** Google sign-in: whether it's set up here, and whether your account is linked to a Google one. */
    google: { available: boolean; linked: boolean };
  };
}

/** Your profile and settings (GET /api/me/profile). */
export async function readProfile(user: SessionUser): Promise<Profile> {
  const [{ rows }, { rows: first }, notify] = await Promise.all([
    pool.query(
      `SELECT u.username, u.name, u.email, s.colour, s.ai, s.theme, COALESCE(s.show_results_immediately, false) AS immediate,
              (EXTRACT(EPOCH FROM p.updated_at) * 1000)::bigint AS picture,
              EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'credential') AS password,
              EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'google') AS google
         FROM "user" u LEFT JOIN user_settings s ON s.user_id = u.id LEFT JOIN user_pictures p ON p.user_id = u.id
        WHERE u.id = $1`,
      [user.id]
    ),
    pool.query(
      `SELECT s.name, ss.season_number FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
        WHERE m.user_id = $1 AND l.solo IS NULL AND l.deleted_at IS NULL
        ORDER BY ss.premiere_date NULLS LAST, ss.season_number LIMIT 1`,
      [user.id]
    ),
    readNotify(user.id),
  ]);
  const r = rows[0];
  if (!r) throw new HttpError(404, "No such account");
  const name = (r.username as string | null) || (r.name as string);
  return {
    name,
    colour: isPaletteColour(r.colour) ? r.colour : null,
    picture: r.picture == null ? null : Number(r.picture),
    ai: AI_CHOICES.includes(r.ai) ? (r.ai as AiChoice) : "chatgpt",
    hideScores: !r.immediate,
    theme: isTheme(r.theme) ? r.theme : DEFAULT_THEME,
    since: first[0] ? `${(first[0].name as string).replace(/^The /, "")}${first[0].season_number ? ` ${first[0].season_number}` : ""}` : null,
    notify,
    sharing: { on: (await sharingOf([user.id])).get(user.id)!, lines: await sharingLines(user.id, name) },
    account: {
      username: (r.username as string | null) ?? null,
      email: realEmail(r.email as string) ?? null,
      password: !!r.password,
      google: { available: googleOn(), linked: !!r.google },
    },
  };
}

/**
 * What each switch of What your couch sees lets out of you, as someone on your couch would read it: from the show you follow openly
 * that you moved along most lately, your latest rating and the show you reacted on most (only shows you follow openly: a show you
 * watch privately is never shared). Where you have none, what it would share.
 */
async function sharingLines(userId: string, name: string): Promise<Record<ShareSwitch, string>> {
  const { rows } = await pool.query(
    `WITH open AS (
       SELECT f.season_id, f.seen_through, f.updated_at, ss.episode_count,
              regexp_replace(regexp_replace(s.name, '^The ', ''), '\\s*\\([^)]*\\)\\s*$', '') || COALESCE(' ' || ss.season_number, '') AS label
         FROM show_follows f JOIN show_seasons ss ON ss.id = f.season_id JOIN shows s ON s.id = ss.show_id
        WHERE f.user_id = $1 AND f.following AND NOT f.private
     )
     SELECT (SELECT row_to_json(x) FROM (SELECT label, seen_through AS seen, episode_count AS count FROM open WHERE seen_through > 0
               ORDER BY updated_at DESC LIMIT 1) x) AS "where",
            (SELECT label FROM open ORDER BY updated_at DESC LIMIT 1) AS now,
            (SELECT row_to_json(x) FROM (SELECT o.label, r.episode, r.stars FROM episode_ratings r JOIN open o ON o.season_id = r.season_id
               WHERE r.user_id = $1 ORDER BY r.updated_at DESC LIMIT 1) x) AS rated,
            (SELECT row_to_json(x) FROM (SELECT o.label, count(*)::int AS n FROM watch_reactions w JOIN open o ON o.season_id = w.season_id
               WHERE w.user_id = $1 GROUP BY o.label ORDER BY n DESC, o.label LIMIT 1) x) AS reacted`,
    [userId]
  );
  const x = rows[0] ?? {};
  const where = x.where as { label: string; seen: number; count: number | null } | null;
  const rated = x.rated as { label: string; episode: number; stars: number } | null;
  const reacted = x.reacted as { label: string; n: number } | null;
  const lines: Record<ShareSwitch, string> = {
    where: where
      ? where.count && where.seen >= where.count
        ? `${name} finished ${where.label}`
        : `${name} is on Episode ${where.seen} of ${where.label}`
      : `What ${name} watches, and how far ${name} is`,
    now: x.now ? `${name} is watching ${x.now} now` : `When ${name} is watching along`,
    ratings: rated ? `${name} rated ${rated.label} Episode ${rated.episode} ★${rated.stars}` : `${name}'s episode ratings`,
    reactions: reacted ? `${name} left ${reacted.n} ${reacted.n === 1 ? "reaction" : "reactions"} on ${reacted.label}` : `${name}'s watch along reactions`,
  };
  return Object.fromEntries(SHARE_SWITCHES.map((k) => [k, lines[k]])) as Record<ShareSwitch, string>;
}

/** Someone viewing the app as you (an admin's "Viewing as") can look, not change who you are. */
function mayChange(session: Session) {
  if (isImpersonating(session)) throw new HttpError(403, "You're viewing as someone. Their profile is theirs to change.");
}

/**
 * Your colour, AI, spoiler setting, a notification moment, What your couch sees or Appearance (PUT /api/me/profile). Only what's
 * sent changes; null colour goes back to the one your id picks. `sharing`: { preset } (all, games, min) or any of the four switches.
 */
export async function saveSettings(
  session: Session,
  body: { colour?: unknown; ai?: unknown; hideScores?: unknown; notify?: unknown; sharing?: unknown; theme?: unknown }
): Promise<void> {
  mayChange(session);
  if (body.notify !== undefined) {
    if (!body.notify || typeof body.notify !== "object") throw new HttpError(400, "notify: { moment, on } or { chat }");
    await saveNotify(session.user.id, body.notify as { moment?: unknown; on?: unknown; chat?: unknown });
    if (Object.keys(body).length === 1) return;
  }
  const sets: string[] = [];
  const args: unknown[] = [session.user.id];
  if ("colour" in body) {
    if (body.colour !== null && !isPaletteColour(body.colour)) throw new HttpError(400, "Pick one of the colours");
    args.push(body.colour);
    sets.push(`colour = $${args.length}`);
  }
  if ("ai" in body) {
    if (!AI_CHOICES.includes(body.ai as AiChoice)) throw new HttpError(400, "ai must be chatgpt, grok, ask or copy");
    args.push(body.ai);
    sets.push(`ai = $${args.length}`);
  }
  if ("hideScores" in body) {
    if (typeof body.hideScores !== "boolean") throw new HttpError(400, "hideScores must be true or false");
    args.push(!body.hideScores);
    sets.push(`show_results_immediately = $${args.length}`);
  }
  if ("theme" in body) {
    if (!isTheme(body.theme)) throw new HttpError(400, "theme must be night, studio or phone");
    args.push(body.theme);
    sets.push(`theme = $${args.length}`);
  }
  if ("sharing" in body) {
    const next = sharingFrom(body.sharing, (await sharingOf([session.user.id])).get(session.user.id)!);
    if (!next) throw new HttpError(400, "sharing: { preset: all, games or min } or any of where, now, ratings, reactions as true or false");
    for (const k of SHARE_SWITCHES) {
      args.push(next[k]);
      sets.push(`share_${k} = $${args.length}`);
    }
  }
  if (!sets.length) throw new HttpError(400, "Nothing to change");
  // A first row gets the column defaults for whatever isn't sent (classic's /api/me/settings writes the same row).
  await pool.query("INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [session.user.id]);
  await pool.query(`UPDATE user_settings SET ${sets.join(", ")}, updated_at = now() WHERE user_id = $1`, args);
}

/** Better Auth's words for a username it refuses, in ours (the way in's, welcome/account.tsx authError). */
function nameRefused(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return "That name's taken. Try another.";
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
    case "INVALID_USERNAME":
      return "A name is 3 to 30 letters, numbers, underscores or dots.";
    default:
      return message || "Couldn't save that name.";
  }
}

/**
 * Your new name (PUT /api/me/profile { name }): your username through Better Auth (its username plugin checks it as sign-up
 * does: 3 to 30 letters, numbers, underscores or dots, not taken; kept in lower case), your account's name with it, then
 * your seat in every league you play renamed to it (where no one else in that league has that name already) and your
 * messages signed with it. Answers the name as kept.
 */
export async function rename(req: Request, session: Session, raw: unknown): Promise<string> {
  mayChange(session);
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!name) throw new HttpError(400, "Your name can't be empty");
  const user = session.user as SessionUser & { username?: string | null };
  if (name !== user.username) {
    try {
      await auth.api.updateUser({ body: { username: name, displayUsername: name, name } as Record<string, string>, headers: req.headers });
    } catch (e) {
      if (isAPIError(e)) {
        const b = e.body as { code?: string; message?: string } | undefined;
        throw new HttpError(400, nameRefused(b?.code, b?.message ?? e.message));
      }
      throw e;
    }
  }
  await renameSeats(user.id, name);
  await pool.query("UPDATE chat_messages SET author_name = $2 WHERE user_id = $1 AND type = 'message' AND author_name IS DISTINCT FROM $2", [user.id, name]);
  return name;
}

/**
 * Your seat in each league you play takes your name: only where it differs, and not where someone else in that league already
 * goes by it (a seat whoever runs the game named, a computer player). Each is a league write like any (withLeagueLock); a
 * league that can't be written keeps the old name, said in the log.
 */
export async function renameSeats(userId: string, name: string): Promise<number> {
  const { rows } = await pool.query("SELECT league_id, player_id FROM league_memberships WHERE user_id = $1 AND player_id IS NOT NULL", [userId]);
  const states = await leagueStates(rows.map((r) => r.league_id as string));
  const same = (a: string | undefined) => (a ?? "").trim().toLowerCase() === name;
  let renamed = 0;
  for (const r of rows) {
    const state = states.get(r.league_id);
    const seat = state?.players.find((p) => p.id === r.player_id);
    if (!state || !seat || seat.name === name || state.players.some((p) => p.id !== r.player_id && same(p.name))) continue;
    try {
      await withLeagueLock(r.league_id, (s) => {
        if (!s.players.some((p) => p.id !== r.player_id && same(p.name))) StateLogic.updatePlayer(s, r.player_id, "name", name);
      });
      renamed++;
    } catch (e) {
      console.error(`[profile] renaming a seat in league ${r.league_id}:`, e);
    }
  }
  return renamed;
}

const PICTURE_TYPES = ["image/jpeg", "image/webp", "image/png"];
export const PICTURE_MAX = 100 * 1024;

/** Your picture (PUT /api/me/picture, the image itself as the body): made small in the browser; refused over 100 KB. */
export async function savePicture(session: Session, type: string | null, bytes: ArrayBuffer): Promise<number> {
  mayChange(session);
  const kind = (type ?? "").split(";")[0].trim();
  if (!PICTURE_TYPES.includes(kind)) throw new HttpError(415, "A picture is a JPEG, WebP or PNG");
  if (!bytes.byteLength) throw new HttpError(400, "No picture came through");
  if (bytes.byteLength > PICTURE_MAX) throw new HttpError(413, "That picture is too big. Try another.");
  const { rows } = await pool.query(
    `INSERT INTO user_pictures (user_id, picture, type, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET picture = $2, type = $3, updated_at = now()
     RETURNING (EXTRACT(EPOCH FROM updated_at) * 1000)::bigint AS v`,
    [session.user.id, Buffer.from(bytes), kind]
  );
  return Number(rows[0].v);
}

export async function removePicture(session: Session): Promise<void> {
  mayChange(session);
  await pool.query("DELETE FROM user_pictures WHERE user_id = $1", [session.user.id]);
}

/** Someone's picture, for a viewer on a couch with them (or themselves, or a site admin); null when there's none to show. */
export async function pictureOf(viewer: SessionUser, userId: string): Promise<{ bytes: Buffer; type: string } | null> {
  const { rows } = await pool.query(
    `SELECT p.picture, p.type FROM user_pictures p
      WHERE p.user_id = $1
        AND ($1 = $2 OR $3 OR EXISTS (SELECT 1 FROM couch_members a JOIN couch_members b ON b.couch_id = a.couch_id WHERE a.user_id = $2 AND b.user_id = $1))`,
    [userId, viewer.id, isSuperAdminUser(viewer)]
  );
  return rows[0] ? { bytes: rows[0].picture as Buffer, type: rows[0].type as string } : null;
}
