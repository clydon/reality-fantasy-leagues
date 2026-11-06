import { auth } from "@/lib/auth";
import { pool } from "./db";
import { HttpError } from "./http-error";
import { roleAtLeast } from "./roles";
import { viewAsOf } from "./view-as";

export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type SessionUser = Session["user"];

export interface LeagueMembership {
  /** "admin" is a Game admin (db/migrations/0105, roles.ts): a member as far as the classic app goes. */
  role: "member" | "admin" | "commissioner";
  playerId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// For validating UUID path params before they reach a query -- Postgres throws (a 500) on a
// malformed uuid literal rather than just matching nothing.
export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function isSuperAdminUser(user: SessionUser): boolean {
  return (user as { role?: string | null }).role === "admin";
}

// Early access gate (db/migrations/0058_user_approval.sql). Only `=== false` blocks -- missing/
// undefined fails open rather than locking someone out over a field that should always be a real
// boolean once the additionalFields config (auth.ts) and migration are both in place.
export function isApprovedUser(user: SessionUser): boolean {
  return (user as { approved?: boolean }).approved !== false;
}

// Every one of these is a direct port of SurvivorDraft's server/auth.js, adapted from Express's
// req/res/next model to Next.js Route Handlers: no req.user to attach to, so each helper takes
// the incoming Request and returns what it needs (or throws HttpError, caught by apiRoute() in
// api-route.ts and turned into the same { error: message } shape SurvivorDraft's error
// middleware produces).
export async function requireSession(req: Request): Promise<Session> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new HttpError(401, "Not logged in");
  touchLastSeen(session);
  // A site admin viewing as a player or a commissioner (view-as.ts) is no site admin for this request.
  if (isSuperAdminUser(session.user) && viewAsOf(req, session.user.id)) return { ...session, user: { ...session.user, role: "user" } };
  return session;
}

// "Last active" for the admin Users table (db/migrations/0032): stamped on any authenticated request,
// skipped while an admin impersonates, and at most once a minute per user (checked in memory first,
// then in the UPDATE itself) so busy pages don't write on every poll. Fire-and-forget: a failed
// stamp must never fail the request. In the same statement, today (Eastern) in user_days (0157): a
// day the app was opened, a couch point (couch-points.ts).
const lastTouched = new Map<string, number>();
function touchLastSeen(session: Session) {
  if (isImpersonating(session)) return;
  const userId = session.user.id;
  const now = Date.now();
  if (now - (lastTouched.get(userId) ?? 0) < 60_000) return;
  lastTouched.set(userId, now);
  pool
    .query(
      `WITH today AS (INSERT INTO user_days (user_id, day) VALUES ($1, (now() AT TIME ZONE 'America/New_York')::date) ON CONFLICT DO NOTHING)
       INSERT INTO user_last_seen (user_id, last_seen_at) VALUES ($1, now())
       ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()
       WHERE user_last_seen.last_seen_at < now() - interval '1 minute'`,
      [userId]
    )
    .catch(() => {});
}

/** True when a super-admin is acting as this user: look, but leave nothing marked read or dismissed. */
export function isImpersonating(session: Session): boolean {
  return !!(session.session as { impersonatedBy?: unknown }).impersonatedBy;
}

export async function requireAuth(req: Request): Promise<SessionUser> {
  const user = (await requireSession(req)).user;
  // requireSession alone (used directly by /api/me) stays open to a pending account, so the
  // client can read `approved: false` and show the pending screen; everything built on top of
  // requireAuth -- every league/admin action -- is where early access actually blocks them.
  if (!isSuperAdminUser(user) && !isApprovedUser(user)) throw new HttpError(403, "Pending approval");
  return user;
}

/** requireAuth, keeping the session (to tell whether an admin is viewing as this person). */
export async function requireAuthSession(req: Request): Promise<Session> {
  const session = await requireSession(req);
  if (!isSuperAdminUser(session.user) && !isApprovedUser(session.user)) throw new HttpError(403, "Pending approval");
  return session;
}

export async function requireSuperAdmin(req: Request): Promise<SessionUser> {
  const user = await requireAuth(req);
  if (!isSuperAdminUser(user)) throw new HttpError(403, "Super-admin only");
  return user;
}

// A super-admin who ALSO happens to be a real member of this league (e.g. they created it and
// draft in it themselves) keeps their real playerId, just with commissioner-level permissions
// layered on top -- only super-admins with no membership at all fall back to a synthetic
// all-access-but-no-player-identity bypass, for managing leagues they're not actually playing in.
// Same reasoning as SurvivorDraft's requireLeagueRole.
export async function requireLeagueRole(
  req: Request,
  leagueId: string,
  minRole: "member" | "admin" | "commissioner"
): Promise<{ user: SessionUser; membership: LeagueMembership }> {
  const user = await requireAuth(req);
  if (!UUID_RE.test(leagueId)) throw new HttpError(404, "League not found");
  const isSuperAdmin = isSuperAdminUser(user);
  const asPlayer = viewAsOf(req, user.id) === "player";

  const { rows } = await pool.query("SELECT role, player_id FROM league_memberships WHERE league_id=$1 AND user_id=$2", [
    leagueId,
    user.id,
  ]);
  if (rows.length) {
    const role: LeagueMembership["role"] = isSuperAdmin ? "commissioner" : asPlayer ? "member" : rows[0].role;
    if (!roleAtLeast(role, minRole)) throw new HttpError(403, minRole === "commissioner" ? "Commissioner only" : "Game admins only");
    return { user, membership: { role, playerId: rows[0].player_id } };
  }
  if (isSuperAdmin) {
    return { user, membership: { role: "commissioner", playerId: null } };
  }
  throw new HttpError(403, "Not a member of this league");
}
