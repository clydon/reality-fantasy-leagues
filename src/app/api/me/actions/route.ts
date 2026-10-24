import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSession } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { dueMoves } from "@/lib/server/due-moves";

// What's waiting on the signed-in user across EVERY league they're in -- the app-wide action bar's
// data (action-bar.tsx), so a lineup or a draft turn due in one league shows while another is open.
// The leagues' items come from due-moves.ts (shared with the new design's home): one query for all of
// them, then actionItems over each league's state.
// `commish`: the leagues you run's own to-dos (commissioner-items.ts: invite players, schedule the
// draft, reveal the next episode), for Overview's control room. Kept apart from `items` so the alert
// strip, the league strip's dots and the reminder job read exactly what they did.
export const GET = apiRoute(async (req) => {
  const { user } = await requireSession(req);
  // Pending invites first: unanswered, they're the easiest thing in the app to never notice (the
  // Dashboard's panel is only seen by someone who goes looking). Same match as /api/me/invites.
  const { rows: invites } = await pool.query(
    `SELECT li.id, li.league_id, l.name AS league_name, inv.username AS invited_by,
            (SELECT p->>'name' FROM jsonb_array_elements(l.state->'players') p WHERE p->>'id' = li.player_id) AS seat_name
     FROM league_invites li
     JOIN leagues l ON l.id = li.league_id
     JOIN "user" u ON u.id = $1
     LEFT JOIN "user" inv ON inv.id = li.invited_by
     WHERE li.status='pending' AND (lower(li.identifier)=lower(u.username) OR lower(li.identifier)=lower(u.email))
     ORDER BY li.created_at DESC`,
    [user.id]
  );
  const inviteItems = invites.map((r) => ({
    kind: "invite" as const,
    text: r.seat_name ? `You're invited to take over ${r.seat_name}'s team` : `You're invited to join ${r.league_name}`,
    href: "/",
    inviteId: r.id as string,
    invitedBy: (r.invited_by as string | null) ?? null,
    leagueId: r.league_id as string,
    leagueName: r.league_name as string,
  }));
  const { items, commish } = await dueMoves(user.id);
  return NextResponse.json({ items: [...inviteItems, ...items], commish });
});
