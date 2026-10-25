import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { leaveGames } from "@/lib/server/backstage-members";

// You leave the couch's games on this season (docs/PLAN-new-design.md step 6a, tier 3: a hold to confirm). Never as the
// last Commissioner of one (409: hand it to someone first). `{ preview: true }` answers what it would do. Whoever runs the
// games can restore you from Recent changes for 30 days.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { preview?: unknown };
  return NextResponse.json(await leaveGames(user, seasonId, new URL(req.url).searchParams.get("couch"), body.preview === true));
});
