import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { couchOnNow } from "@/lib/server/watch-along";

// The hub's On now (docs/PLAN-new-design.md step 13 part 2; watch-along.ts couchOnNow): who else on the couch has a watch along
// open right now, on which show and episode, and whether it's the live airing. Read when the hub opens, never polled.
type Params = { params: Promise<{ couchId: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await couchOnNow(user, couchId));
});
