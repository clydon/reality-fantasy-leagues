import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js GET /leagues.
export const GET = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const { rows } = await pool.query("SELECT id, name, slug, join_code, created_at FROM leagues ORDER BY name");
  return NextResponse.json({ leagues: rows });
});
