import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { couchHub } from "@/lib/server/couch-hub";

// The hub's couch (docs/PLAN-new-design.md step 8): power rankings, the trophy shelf, Commercial break's games, By the
// numbers' couch accolades, your numbers and On the couch, as you may see them (couch-hub.ts). For someone on the couch
// (or a site admin); 404 otherwise. Read when the hub opens, not polled.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await couchHub(user, couchId));
});
