import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { leagueDeleted } from "@/lib/server/couches";

// Port of SurvivorDraft's server/routes/admin.js DELETE /leagues/:leagueId.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  await requireSuperAdmin(req);
  const { leagueId } = await params;
  const { rows } = await pool.query("DELETE FROM leagues WHERE id=$1 RETURNING couch_id", [leagueId]);
  // Its couch goes too if it has no games left (couches.ts).
  await leagueDeleted(rows[0]?.couch_id ?? null);
  return NextResponse.json({ ok: true });
});
