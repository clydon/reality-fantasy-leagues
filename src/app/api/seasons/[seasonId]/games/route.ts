import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError, pool } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { seasonGames } from "@/lib/server/season-games";

// Your games on a show (docs/PLAN-new-design.md step 1): with `?couch=` that couch's games here that you play, else
// all of yours. Each one's moves for the next episode, its table, its rules and its cast, as far as you've seen
// (season-games.ts, game-view.ts). The sheet that changes them writes through the league routes.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const couchId = new URL(req.url).searchParams.get("couch");
  if (couchId) await requireCouch(user, couchId);
  return NextResponse.json(await seasonGames(user, seasonId, couchId));
});
