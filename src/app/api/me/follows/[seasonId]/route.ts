import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { setFollow, type FollowChange } from "@/lib/server/follows";

// Your follow of a season (db/migrations/0102, follows.ts): body { seenThrough?, following?, private? }. Where
// you are only for a season you don't play: on one you play, it moves with your games' reveals (409).
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const body = (await req.json().catch(() => ({}))) as FollowChange;
  return NextResponse.json(await setFollow(user.id, seasonId, body));
});
