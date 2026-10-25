import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { undoBatch } from "@/lib/server/league-changes";

// Undo one change in Recent changes (step 5): in every game it touched, for whoever runs them all, until the next
// episode airs. 409 when it can't be any more (undone already, too late, or a later change to that episode first).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string; batch: string }> }) => {
  const { seasonId, batch } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId) || !isUuid(batch)) throw new HttpError(404, "Not found");
  const couchId = new URL(req.url).searchParams.get("couch");
  if (!couchId) throw new HttpError(400, "couch required");
  return NextResponse.json(await undoBatch(user, seasonId, couchId, batch));
});
