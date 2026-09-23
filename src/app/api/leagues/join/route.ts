import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { joinLeague } from "@/lib/server/join-league";

// Port of SurvivorDraft's server/routes/leagues.js POST /join -- joins by share code, becomes a
// member with a new player slot (or reclaims their own old one, see joinLeague).
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed) throw new HttpError(400, "Join code required");

  const { rows } = await pool.query("SELECT id FROM leagues WHERE join_code=$1", [trimmed]);
  if (!rows.length) throw new HttpError(404, "No league found with that code");

  return NextResponse.json(await joinLeague(rows[0].id, user));
});
