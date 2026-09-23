import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { toAdminUser, lastLoginByUserId } from "@/lib/server/admin-users";

// Change a user's username and/or email via Better Auth's admin plugin (adminUpdateUser), which
// validates email format + uniqueness itself. Username needs extra care: the username plugin's
// update hook checks "already taken" against the *calling admin's* session id, not the target
// user's -- so re-submitting the target's own unchanged username would falsely read as taken,
// and taking the admin's own username would slip past it. So only a changed username is sent,
// and uniqueness is checked here against the target instead.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  await requireSuperAdmin(req);
  const { userId } = await params;
  const { username, email } = (await req.json().catch(() => ({}))) as { username?: string; email?: string };

  const current = await pool.query(`SELECT username, email FROM "user" WHERE id=$1`, [userId]);
  if (!current.rows.length) throw new HttpError(404, "User not found");

  const data: Record<string, unknown> = {};
  if (typeof username === "string" && username.trim() && username.trim().toLowerCase() !== current.rows[0].username) {
    const trimmed = username.trim();
    const taken = await pool.query(`SELECT 1 FROM "user" WHERE lower(username)=lower($1) AND id<>$2`, [trimmed, userId]);
    if (taken.rows.length) throw new HttpError(409, "That username is already taken");
    data.username = trimmed;
    data.displayUsername = trimmed;
  }
  if (typeof email === "string" && email.trim() && email.trim().toLowerCase() !== current.rows[0].email) {
    data.email = email.trim();
  }
  if (Object.keys(data).length === 0) throw new HttpError(400, "Nothing to change");

  try {
    const updated = await auth.api.adminUpdateUser({ body: { userId, data }, headers: req.headers });
    const lastLogins = await lastLoginByUserId([userId]);
    return NextResponse.json({ user: toAdminUser(updated as Parameters<typeof toAdminUser>[0], lastLogins.get(userId) ?? null) });
  } catch (e) {
    // Better Auth's own validation (bad email, email in use, invalid username characters/length).
    if (isAPIError(e)) throw new HttpError(e.statusCode >= 500 ? 500 : 400, e.message || "Invalid update");
    throw e;
  }
});

// Port of SurvivorDraft's server/routes/admin.js DELETE /users/:userId -- deletes the account
// outright, but disables (not removes) any player seats it's linked to first, so roster/points
// history in each league stays intact instead of turning into an orphaned real username with no
// owner. Same treatment as removing a player directly (RosterLogic.disablePlayer).
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  const admin = await requireSuperAdmin(req);
  const { userId } = await params;
  if (userId === admin.id) throw new HttpError(400, "You can't delete your own account");

  const memberships = await pool.query("SELECT league_id, player_id FROM league_memberships WHERE user_id=$1", [userId]);
  for (const m of memberships.rows) {
    const leagueRes = await pool.query("SELECT state FROM leagues WHERE id=$1", [m.league_id]);
    if (!leagueRes.rows.length) continue;
    const state = leagueRes.rows[0].state;
    StateLogic.disablePlayer(state, m.player_id, userId);
    await pool.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), m.league_id]);
  }

  await auth.api.removeUser({ body: { userId }, headers: req.headers });
  return NextResponse.json({ ok: true });
});
