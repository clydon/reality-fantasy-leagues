import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError, pool } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { seasonStats } from "@/lib/server/season-stats";

// A season's cast stats (docs/PLAN-new-design.md step 3), counted over Episodes ?from= to ?to= (both clamped to where
// you are): with `?couch=`, points as that couch's game here counts them. For anyone, playing or not (season-stats.ts).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const q = new URL(req.url).searchParams;
  const couchId = q.get("couch");
  if (couchId) await requireCouch(user, couchId);
  return NextResponse.json(await seasonStats(user, seasonId, couchId, { from: q.get("from"), to: q.get("to") }));
});
