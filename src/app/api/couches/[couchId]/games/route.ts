import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { couchGamesFor } from "@/lib/server/couch-joins";

// Every game on the couch and who may join it (step 9): Commercial break, the join page, a show's Games tab. Not polled.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await couchGamesFor(user, couchId));
});
