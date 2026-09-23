import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSession } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Combines Better Auth's own session with this app's league_memberships table -- matches the
// {user, leagues, impersonating} shape src/lib/api.ts's MeResponse/auth-gate.tsx already expect,
// so the client's loadFirstLeague() barely changes moving off the old SurvivorDraft-backed /me.
// "My Leagues" reflects real membership only, even for a super-admin (see SurvivorDraft's own
// server/routes/auth.js comment on this same point) -- the Admin tab is where they see/manage
// every league regardless of personal membership.
export const GET = apiRoute(async (req) => {
  const { user, session } = await requireSession(req);
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.join_code, m.role FROM league_memberships m
     JOIN leagues l ON l.id = m.league_id WHERE m.user_id=$1
     ORDER BY l.name`,
    [user.id]
  );
  return NextResponse.json({
    user: {
      id: user.id,
      username: (user as { username?: string | null }).username,
      isSuperAdmin: (user as { role?: string | null }).role === "admin",
    },
    leagues: rows,
    // Better Auth's admin plugin marks impersonation on the session row (impersonatedBy), not
    // the user -- same underlying idea as SurvivorDraft's separate req.session.impersonatorId.
    impersonating: !!(session as { impersonatedBy?: unknown }).impersonatedBy,
  });
});
