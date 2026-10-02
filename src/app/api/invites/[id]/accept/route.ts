import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { loadOwnPendingInvite } from "@/lib/server/invites";
import { joinLeague } from "@/lib/server/join-league";

const MARK_ACCEPTED = "UPDATE league_invites SET status='accepted', responded_at=now() WHERE id=$1 AND status='pending'";

// Same join as POST /api/leagues/join (including reclaiming an old seat), with the invite marked
// accepted in the same transaction. An invite that hands over a seat joins them into that seat. If they already joined by code in the meantime, the invite
// is just closed out as accepted rather than erroring.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireAuth(req);
  const invite = await loadOwnPendingInvite(id, user);

  const member = await pool.query("SELECT 1 FROM league_memberships WHERE league_id=$1 AND user_id=$2", [invite.league_id, user.id]);
  if (member.rows.length) {
    await pool.query(MARK_ACCEPTED, [invite.id]);
    const { rows } = await pool.query("SELECT id, name FROM leagues WHERE id=$1", [invite.league_id]);
    return NextResponse.json({ league: rows[0], reclaimed: false });
  }

  const result = await joinLeague(
    invite.league_id,
    user,
    async (client) => {
      await client.query(MARK_ACCEPTED, [invite.id]);
    },
    invite.player_id
  );
  return NextResponse.json(result);
});
