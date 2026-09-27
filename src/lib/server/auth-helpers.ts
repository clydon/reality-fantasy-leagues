import { auth } from "@/lib/auth";
import { pool } from "./db";
import { HttpError } from "./http-error";

export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type SessionUser = Session["user"];

export interface LeagueMembership {
  role: "member" | "commissioner";
  playerId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// For validating UUID path params before they reach a query -- Postgres throws (a 500) on a
// malformed uuid literal rather than just matching nothing.
export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

function isSuperAdminUser(user: SessionUser): boolean {
  return (user as { role?: string | null }).role === "admin";
}

// Every one of these is a direct port of SurvivorDraft's server/auth.js, adapted from Express's
// req/res/next model to Next.js Route Handlers: no req.user to attach to, so each helper takes
// the incoming Request and returns what it needs (or throws HttpError, caught by apiRoute() in
// api-route.ts and turned into the same { error: message } shape SurvivorDraft's error
// middleware produces).
export async function requireSession(req: Request): Promise<Session> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new HttpError(401, "Not logged in");
  return session;
}

/** True when a super-admin is acting as this user: look, but leave nothing marked read or dismissed. */
export function isImpersonating(session: Session): boolean {
  return !!(session.session as { impersonatedBy?: unknown }).impersonatedBy;
}

export async function requireAuth(req: Request): Promise<SessionUser> {
  return (await requireSession(req)).user;
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
  minRole: "member" | "commissioner"
): Promise<{ user: SessionUser; membership: LeagueMembership }> {
  const user = await requireAuth(req);
  if (!UUID_RE.test(leagueId)) throw new HttpError(404, "League not found");
  const isSuperAdmin = isSuperAdminUser(user);

  const { rows } = await pool.query("SELECT role, player_id FROM league_memberships WHERE league_id=$1 AND user_id=$2", [
    leagueId,
    user.id,
  ]);
  if (rows.length) {
    const role: LeagueMembership["role"] = isSuperAdmin ? "commissioner" : rows[0].role;
    if (minRole === "commissioner" && role !== "commissioner") throw new HttpError(403, "Commissioner only");
    return { user, membership: { role, playerId: rows[0].player_id } };
  }
  if (isSuperAdmin) {
    return { user, membership: { role: "commissioner", playerId: null } };
  }
  throw new HttpError(403, "Not a member of this league");
}
