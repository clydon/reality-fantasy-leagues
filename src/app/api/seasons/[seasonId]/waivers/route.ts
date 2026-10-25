import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError, pool } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { seasonWaivers } from "@/lib/server/season-waivers";

// Your waivers on a show (docs/PLAN-new-design.md step 6a): with `?couch=` that couch's games here that you play, else all
// of yours. Each game's week: who of yours to replace, optional swaps, your team, who's free, your own picks, the picking
// order and the last run, as far as you've seen (season-waivers.ts, waiver-view.ts). Picks are saved through the league
// routes (/waivers/claims, /waivers/free-agency).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const couchId = new URL(req.url).searchParams.get("couch");
  if (couchId) await requireCouch(user, couchId);
  return NextResponse.json(await seasonWaivers(user, seasonId, couchId));
});
