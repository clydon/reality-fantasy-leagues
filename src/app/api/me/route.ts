import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSession } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";

// Combines Better Auth's own session with this app's league_memberships table -- matches the
// {user, leagues, impersonating} shape src/lib/api.ts's MeResponse/auth-gate.tsx already expect,
// so the client's loadFirstLeague() barely changes moving off the old SurvivorDraft-backed /me.
// "My Leagues" reflects real membership only, even for a super-admin (see SurvivorDraft's own
// server/routes/auth.js comment on this same point) -- the Admin tab is where they see/manage
// every league regardless of personal membership.
export const GET = apiRoute(async (req) => {
  const { user, session } = await requireSession(req);
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.join_code, m.role, l.state FROM league_memberships m
     JOIN leagues l ON l.id = m.league_id WHERE m.user_id=$1
     ORDER BY l.name`,
    [user.id]
  );
  // Each league's type and show resolved here, and the list returned already in display order
  // (Active Roster, Classic, Eliminator Pool, then anything else; alphabetical within), so the
  // league dropdowns render sorted on first paint instead of re-sorting once a per-league
  // state fetch lands.
  const order = ["Active Roster", "Classic", "Eliminator Pool"];
  const rank = (type: string) => (order.indexOf(type) + order.length + 1) % (order.length + 1);
  const leagues = rows
    .map(({ state, ...l }) => ({
      ...l,
      type: StateLogic.getLeagueType(state).name as string,
      showId: (state.settings?.showId ?? null) as string | null,
    }))
    .sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name));
  return NextResponse.json({
    user: {
      id: user.id,
      username: (user as { username?: string | null }).username,
      isSuperAdmin: (user as { role?: string | null }).role === "admin",
    },
    leagues,
    // Better Auth's admin plugin marks impersonation on the session row (impersonatedBy), not
    // the user -- same underlying idea as SurvivorDraft's separate req.session.impersonatorId.
    impersonating: !!(session as { impersonatedBy?: unknown }).impersonatedBy,
  });
});
