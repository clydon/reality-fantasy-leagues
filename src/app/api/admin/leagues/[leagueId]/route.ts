import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js DELETE /leagues/:leagueId.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  await requireSuperAdmin(req);
  const { leagueId } = await params;
  await pool.query("DELETE FROM leagues WHERE id=$1", [leagueId]);
  return NextResponse.json({ ok: true });
});
