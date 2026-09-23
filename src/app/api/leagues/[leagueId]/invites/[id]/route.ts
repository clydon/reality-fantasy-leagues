import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Revokes a pending invite -- only whoever sent it, or a commissioner (super-admins count, see
// requireLeagueRole).
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (!isUuid(id)) throw new HttpError(404, "Invite not found");

  const { rows } = await pool.query("SELECT invited_by, status FROM league_invites WHERE id=$1 AND league_id=$2", [id, leagueId]);
  if (!rows.length) throw new HttpError(404, "Invite not found");
  if (rows[0].status !== "pending") throw new HttpError(400, "Only pending invites can be revoked");
  if (rows[0].invited_by !== user.id && membership.role !== "commissioner") {
    throw new HttpError(403, "Only the person who sent this invite or the commissioner can revoke it");
  }

  await pool.query("DELETE FROM league_invites WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
});
