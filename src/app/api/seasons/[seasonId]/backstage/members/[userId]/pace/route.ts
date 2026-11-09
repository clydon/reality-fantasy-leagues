import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { setMemberPace } from "@/lib/server/backstage-members";

// Plays at their own pace (docs/PLAN-own-pace-games.md): `{ leagueId, on }`, a Commissioner's switch for this person in one game
// here. On, their moves for an aired episode stay open until they've watched it or the next episode airs.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string; userId: string }> }) => {
  const { seasonId, userId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { leagueId?: unknown; on?: unknown };
  return NextResponse.json(await setMemberPace(user, seasonId, new URL(req.url).searchParams.get("couch"), userId, body.leagueId, body.on));
});
