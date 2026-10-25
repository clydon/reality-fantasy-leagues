import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { setMemberRole } from "@/lib/server/backstage-members";

// Someone's role in the couch's games here (step 6a): `{ role, leagueIds? }`, every game of theirs you're a Commissioner of
// unless `leagueIds` says which. One batch in Recent changes with Undo; the last Commissioner can't step down (409).
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string; userId: string }> }) => {
  const { seasonId, userId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { role?: unknown; leagueIds?: unknown };
  return NextResponse.json(await setMemberRole(user, seasonId, new URL(req.url).searchParams.get("couch"), userId, body.role, body.leagueIds));
});
