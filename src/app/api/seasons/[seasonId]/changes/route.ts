import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { changesFor } from "@/lib/server/league-changes";

// Recent changes to the couch's games on a season (docs/PLAN-new-design.md step 5), for everyone on the couch: one line
// per change, newest first, each saying who and when, and whether you can still undo it. Not polled.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = new URL(req.url).searchParams.get("couch");
  if (!couchId) throw new HttpError(400, "couch required");
  return NextResponse.json(await changesFor(user, seasonId, couchId));
});
