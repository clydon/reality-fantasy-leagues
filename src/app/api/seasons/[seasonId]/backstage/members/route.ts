import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { membersFor } from "@/lib/server/backstage-members";

// Backstage › Members & roles (docs/PLAN-new-design.md step 6a), for whoever runs a game here: the couch's games on the
// season, everyone in them and their role in each.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await membersFor(user, seasonId, new URL(req.url).searchParams.get("couch")));
});
