import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSession } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// Combines Better Auth's own session with this app's league_memberships table -- matches the
// {user, leagues, impersonating} shape src/lib/api.ts's MeResponse/auth-gate.tsx already expect,
// so the client's loadFirstLeague() barely changes moving off the old SurvivorDraft-backed /me.
// "My Leagues" reflects real membership only, even for a super-admin (see SurvivorDraft's own
// server/routes/auth.js comment on this same point) -- the Admin tab is where they see/manage
// every league regardless of personal membership.
export const GET = apiRoute(async (req) => {
  const { user, session } = await requireSession(req);
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.join_code, m.role, l.state, l.group_id, l.group_position, g.favorite_league_id FROM league_memberships m
     JOIN leagues l ON l.id = m.league_id LEFT JOIN league_groups g ON g.id = l.group_id WHERE m.user_id=$1
     ORDER BY l.name`,
    [user.id]
  );
  // Each league's type and show resolved here, and the list returned already in display order
  // (Active Roster, Classic, Eliminator Pool, then anything else; alphabetical within), so the
  // league dropdowns render sorted on first paint instead of re-sorting once a per-league
  // state fetch lands.
  // A league whose state can't be read still lists (unsorted, last) -- this route is sign-in itself.
  const typeOf = (state: LeagueState) => {
    try {
      return StateLogic.getLeagueType(state).name as string;
    } catch {
      return "?";
    }
  };
  const order = ["Active Roster", "Classic", "Eliminator Pool"];
  const rank = (type: string) => (order.indexOf(type) + order.length + 1) % (order.length + 1);
  const group = new Map(rows.map((r) => [r.id as string, { id: r.group_id as string | null, position: r.group_position as number | null }]));
  const sorted = rows
    .map(({ id, name, join_code, role, state, favorite_league_id }) => ({
      id: id as string,
      name: name as string,
      join_code: join_code as string,
      role: role as string,
      type: typeOf(state),
      showId: (state.settings?.showId ?? null) as string | null,
      // The league the app opens on in place of this one: its linked group's favorite (0046), if any.
      landOn: (favorite_league_id ?? null) as string | null,
    }))
    .sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name));
  // A linked group keeps the places its leagues already take on the list, filled in the order its
  // commissioner set (league-groups.ts's groupOrder: positioned first, then by name) -- the same
  // order the swipe follows.
  const groupSlots = new Map<string, number[]>();
  sorted.forEach((l, i) => {
    const g = group.get(l.id)!.id;
    if (g) groupSlots.set(g, [...(groupSlots.get(g) ?? []), i]);
  });
  const leagues = [...sorted];
  const pos = (id: string) => group.get(id)!.position ?? Infinity;
  for (const [groupId, slots] of groupSlots) {
    const members = sorted
      .filter((l) => group.get(l.id)!.id === groupId)
      .sort((a, b) => pos(a.id) - pos(b.id) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    slots.forEach((slot, i) => (leagues[slot] = members[i]));
  }
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
