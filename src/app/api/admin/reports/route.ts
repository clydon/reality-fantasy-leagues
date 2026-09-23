import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js GET /reports.
export const GET = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const { rows } = await pool.query("SELECT * FROM issue_reports ORDER BY created_at DESC LIMIT 300");
  return NextResponse.json({ reports: rows });
});
