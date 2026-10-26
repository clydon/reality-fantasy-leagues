import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { couchVerdicts } from "@/lib/server/ratings";

// Couch verdicts (docs/PLAN-new-design.md step 12 part 1; ratings.ts couchVerdicts): each show you've started, its latest
// episode you've seen and how the couch rated it. For someone on the couch (or a site admin); read when the page opens.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await couchVerdicts(user, couchId));
});
