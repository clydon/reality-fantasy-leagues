import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js DELETE /reports/:id.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireSuperAdmin(req);
  const { id } = await params;
  await pool.query("DELETE FROM issue_reports WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
});
