import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { loadOwnPendingInvite } from "@/lib/server/invites";

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireAuth(req);
  const invite = await loadOwnPendingInvite(id, user);
  await pool.query("UPDATE league_invites SET status='declined', responded_at=now() WHERE id=$1 AND status='pending'", [invite.id]);
  return NextResponse.json({ ok: true });
});
