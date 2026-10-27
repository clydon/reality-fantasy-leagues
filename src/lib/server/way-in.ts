import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { realEmail } from "@/lib/no-email";
import { signupModeOf, type SignupMode } from "@/lib/signups";
import { resolveArtStyle, type ArtStyle } from "@/lib/show-art-style";
import { isApprovedUser, isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { setFollow } from "./follows";
import { addShow } from "./add-show";
import { latestAired, seasonSchedules, upNext } from "./schedule";

// The way in (docs/PLAN-new-design.md step 9 part 2; the mock's landing.js): what the landing, first run, sign-in and a
// signed-out invite need from the server. The catalog first run picks from (open signed out: show and season names,
// art, how far each has aired, nothing about any episode), saving first run's shows for a new account, who gets in
// (src/lib/signups.ts), and whether Google sign-in and password emails are set up.

/** Who gets in, as the desk set it. */
export async function signupMode(): Promise<SignupMode> {
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'signups'");
  return signupModeOf(rows[0]?.value);
}

/** Google sign-in is on once its OAuth app's keys are set (auth.ts makes the provider from the same two). */
export const googleOn = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/**
 * How a password reset reaches someone: emailed (Resend is set up), written to the server's console (local dev with no
 * key: auth.ts logs the link), or not at all (a deployment with no key).
 */
export function resetBy(): "email" | "console" | "off" {
  if (process.env.RESEND_API_KEY) return "email";
  return process.env.NODE_ENV === "production" ? "off" : "console";
}

export interface WayInMe {
  id: string;
  name: string;
  username: string | null;
  /** Their real email (never a username-only account's stand-in), for "Signed in with Google as ...". */
  email: string | null;
  /** Let in (early access); a site admin always is. */
  approved: boolean;
}

export interface WayIn {
  me: WayInMe | null;
  google: boolean;
  reset: "email" | "console" | "off";
  signups: SignupMode;
}

export function wayInMe(user: SessionUser): WayInMe {
  const u = user as SessionUser & { username?: string | null };
  return {
    id: user.id,
    name: u.username || user.name,
    username: u.username ?? null,
    email: realEmail(user.email),
    approved: isSuperAdminUser(user) || isApprovedUser(user),
  };
}

/** For a way-in page's server render: who's here (if anyone), and how they can get in. */
export async function wayIn(): Promise<WayIn> {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  return { me: session ? wayInMe(session.user) : null, google: googleOn(), reset: resetBy(), signups: await signupMode() };
}

// ---------- the catalog ----------

export interface CatalogSeason {
  seasonId: string;
  /** The show's name as people say it: "The Traitors" (a trailing "(US)" or "(US flagship)" dropped). */
  show: string;
  /** "Survivor 51". */
  label: string;
  /** "Season 51", or the season's own name. */
  season: string;
  artUrl: string | null;
  /** Where the art's crop centres (shows.art_style). */
  artPosition: string;
  status: "upcoming" | "airing" | "completed";
  premiere: string | null;
  /** The latest episode that has aired (0 before the premiere); null for a finished season whose length isn't known. */
  aired: number | null;
  /** The weekday it airs on next, in its own time zone ("Wed"). */
  airsOn: string | null;
  /** First run's wall: the curated seasons on now or coming up. The rest are found by searching. */
  wall: boolean;
  /** Set up as a game (step 10): false is "Not a game yet", a show someone added to follow. */
  ready: boolean;
  /** An admin set the show up (shows.created_by NULL), rather than someone adding it. */
  curated: boolean;
  /** Its TVmaze id, when it came from (or was matched to) the TV listings: Add a show leaves that listing out. */
  tvmazeId: number | null;
  /** Where it airs and from which country, from its listing: two shows with one name told apart. */
  network: string | null;
  country: string | null;
}

/** A show's name as people say it: a trailing parenthetical ("(US)", "(American edition)") dropped. */
export const plainShow = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/**
 * Every season someone can follow (first run, Add a show): every show's seasons, the curated ones (an admin set them up)
 * and those someone added (step 10: from the TV listings or by name, "Not a game yet" until someone makes them one). On
 * now or coming up first, then the rest newest first. First run's wall is only the curated ones on now or coming up.
 */
export async function catalog(now = new Date()): Promise<CatalogSeason[]> {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.name, ss.status, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere,
            s.name AS show_name, CASE WHEN s.art_off THEN NULL ELSE COALESCE(NULLIF(ss.art_url, ''), s.art_url) END AS art_url, s.art_style, s.created_by IS NULL AS curated, s.set_up_at IS NOT NULL AS ready, s.tvmaze_id,
            s.listing->>'network' AS network, s.listing->>'country' AS country
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.archived = false`
  );
  const schedules = await seasonSchedules(rows.map((r) => r.id as string), now);
  const list: CatalogSeason[] = rows.map((r) => {
    const schedule = schedules.get(r.id);
    const show = plainShow(r.show_name);
    const done = r.status === "completed";
    const aired = latestAired(schedule, now);
    const next = done ? null : upNext(schedule, now);
    const style = resolveArtStyle(r.art_style as ArtStyle | null);
    return {
      seasonId: r.id,
      show,
      label: `${show}${r.season_number ? ` ${r.season_number}` : ""}`,
      season: r.name && !/^\s*$/.test(r.name) && !r.name.startsWith(r.show_name) ? r.name : `Season ${r.season_number}`,
      artUrl: r.art_url || null,
      artPosition: `${style.x}% ${style.y}%`,
      status: r.status,
      premiere: r.premiere,
      aired: done ? (aired || schedule?.episodeCount || schedule?.episodes.length || null) : aired,
      airsOn: next?.airAt && schedule ? new Date(next.airAt).toLocaleDateString("en-US", { weekday: "short", timeZone: schedule.airTz }) : null,
      wall: !done && r.curated && r.ready,
      ready: r.ready,
      curated: r.curated,
      tvmazeId: r.tvmaze_id ?? null,
      network: r.network ?? null,
      country: r.country ?? null,
    };
  });
  const rank = (s: CatalogSeason) => (s.status === "airing" ? 0 : s.status === "upcoming" ? 1 : 2);
  return list.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 0 ? a.show.localeCompare(b.show) : rank(a) === 1 ? (a.premiere ?? "9").localeCompare(b.premiere ?? "9") : (b.premiere ?? "").localeCompare(a.premiere ?? "")) ||
      b.label.localeCompare(a.label)
  );
}

// ---------- saving first run ----------

const MAX_FOLLOWS = 40;

/**
 * First run's shows for a new account (POST /api/me/first-run): each followed openly with where you are, and the new
 * design as the one this account opens on. Open to an account still waiting to get in (its own shows are all it
 * saves). A season you already play keeps its mark (it moves with your games' reveals).
 */
export async function saveFirstRun(user: SessionUser, body: { follows?: unknown; ui?: unknown }, listings?: string): Promise<{ saved: number }> {
  const follows = Array.isArray(body.follows) ? body.follows : [];
  if (follows.length > MAX_FOLLOWS) throw new HttpError(400, `At most ${MAX_FOLLOWS} shows at once`);
  let saved = 0;
  for (const f of follows as { seasonId?: unknown; listing?: unknown; name?: unknown; seenThrough?: unknown }[]) {
    const seen = Number.isInteger(f?.seenThrough) && (f.seenThrough as number) >= 0 ? (f.seenThrough as number) : 0;
    // A show first run found in the TV listings, or added by name (step 10): made if it has to be, then followed.
    // By name only once you're let in: a name nobody can check would be one more show in everyone's search.
    const byName = typeof f?.name === "string" && (isSuperAdminUser(user) || isApprovedUser(user));
    if (listings && (f?.listing !== undefined || byName)) {
      try {
        await addShow(user.id, { listing: f.listing, name: f.listing === undefined ? f.name : undefined, seenThrough: seen }, listings);
        saved++;
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        console.error(`[first-run] ${user.id} couldn't add a show:`, e.message);
      }
      continue;
    }
    if (typeof f?.seasonId !== "string" || !isUuid(f.seasonId)) continue;
    try {
      await setFollow(user.id, f.seasonId, { following: true, seenThrough: seen });
      saved++;
    } catch (e) {
      // You play it (409), or the mark is past what's listed (400): follow it, and the mark stays as it is.
      if (!(e instanceof HttpError) || e.status === 404) continue;
      await setFollow(user.id, f.seasonId, { following: true });
      saved++;
    }
  }
  if (body.ui === "new") {
    await pool.query(
      `INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new', updated_at = now()`,
      [user.id]
    );
  }
  return { saved };
}

/** Accounts waiting to get in (early access), for the desk's Who gets in. */
export async function waitingCount(): Promise<number> {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "user" WHERE approved = false AND banned IS NOT TRUE`);
  return rows[0].n;
}
