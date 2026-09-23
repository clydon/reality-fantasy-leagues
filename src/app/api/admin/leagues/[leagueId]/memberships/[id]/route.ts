import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js DELETE /leagues/:leagueId/memberships/:id.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  await requireSuperAdmin(req);
  const { leagueId, id } = await params;
  await pool.query("DELETE FROM league_memberships WHERE id=$1 AND league_id=$2", [id, leagueId]);
  return NextResponse.json({ ok: true });
});
