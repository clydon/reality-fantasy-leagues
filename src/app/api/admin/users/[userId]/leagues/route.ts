import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js GET /users/:userId/leagues -- used by the
// delete-user confirmation flow to warn which leagues (if any) this account currently belongs to,
// and by the admin user-edit modal (membership_id/player_id let it change role or unlink).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  await requireSuperAdmin(req);
  const { userId } = await params;
  const { rows } = await pool.query(
    `SELECT l.id, l.name, m.role, m.id AS membership_id, m.player_id FROM league_memberships m
     JOIN leagues l ON l.id = m.league_id WHERE m.user_id=$1 ORDER BY l.name`,
    [userId]
  );
  return NextResponse.json({ leagues: rows });
});
