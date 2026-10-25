import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { scoringRules } from "@/lib/server/backstage-games";

// Backstage › Scoring rules, the read side (docs/PLAN-new-design.md step 6a): the rulebook these games follow and each
// game's points as it counts them, through your mark. Make it ours (the couch's own copy) is step 6b's.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  return NextResponse.json(await scoringRules(scope));
});
