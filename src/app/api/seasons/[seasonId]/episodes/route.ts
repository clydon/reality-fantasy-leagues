import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError, pool } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { readOnlyFor } from "@/lib/server/read-only";
import { seasonEpisodes } from "@/lib/server/season-episodes";

// A show's episodes (docs/PLAN-new-design.md step 2): with `?couch=` told from that couch's games here that you play,
// else from all of yours; playing none, the season's own results. As far as you've seen (season-episodes.ts). Open
// read-only from the desk (read-only.ts): told from that couch game, as the couch has it.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const couchId = new URL(req.url).searchParams.get("couch");
  if (couchId) await requireCouch(user, couchId);
  return NextResponse.json(await seasonEpisodes(user, seasonId, couchId, await readOnlyFor(req, user, seasonId, couchId)));
});
