import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { unsay } from "@/lib/server/watch-along";

// Take back something you said in a watch along (docs/PLAN-new-design.md step 13 part 1): your own only.
type Params = { params: Promise<{ seasonId: string; n: string; reactionId: string }> };

export const DELETE = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n, reactionId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await unsay(user, seasonId, n, reactionId));
});
