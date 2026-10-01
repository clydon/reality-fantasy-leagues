import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSession } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { actionItems } from "@/lib/game/action-items";

// What's waiting on the signed-in user across EVERY league they're in -- the app-wide action bar's
// data (action-bar.tsx), so a lineup or a draft turn due in one league shows while another is open.
// One query for all of them; actionItems is pure, so this is just a fan-out over league state.
// Leagues in My Leagues order (alphabetical); items within a league keep actionItems' urgency order.
export const GET = apiRoute(async (req) => {
  const { user } = await requireSession(req);
  // Pending invites first: unanswered, they're the easiest thing in the app to never notice (the
  // Dashboard's panel is only seen by someone who goes looking). Same match as /api/me/invites.
  const { rows: invites } = await pool.query(
    `SELECT li.id, li.league_id, l.name AS league_name, inv.username AS invited_by
     FROM league_invites li
     JOIN leagues l ON l.id = li.league_id
     JOIN "user" u ON u.id = $1
     LEFT JOIN "user" inv ON inv.id = li.invited_by
     WHERE li.status='pending' AND (lower(li.identifier)=lower(u.username) OR lower(li.identifier)=lower(u.email))
     ORDER BY li.created_at DESC`,
    [user.id]
  );
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.state, m.player_id FROM league_memberships m
     JOIN leagues l ON l.id = m.league_id WHERE m.user_id=$1
     ORDER BY l.name`,
    [user.id]
  );
  const inviteItems = invites.map((r) => ({
    kind: "invite" as const,
    text: `You're invited to join ${r.league_name}`,
    href: "/",
    inviteId: r.id as string,
    invitedBy: (r.invited_by as string | null) ?? null,
    leagueId: r.league_id as string,
    leagueName: r.league_name as string,
  }));
  const leagueItems = rows.flatMap((r) =>
    r.player_id ? actionItems(r.state, r.player_id).map((it) => ({ ...it, leagueId: r.id as string, leagueName: r.name as string })) : []
  );
  return NextResponse.json({ items: [...inviteItems, ...leagueItems] });
});
