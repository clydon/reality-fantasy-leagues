import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { watchCard } from "@/lib/server/watch-along";

// Watch along's card on Tonight (docs/PLAN-new-design.md step 13 part 1; watch-along.ts), on a couch (`?couch=`): the episode
// you'd watch along (your next once it's aired, or the next to air when you're caught up) and who on the couch left reactions on
// it, a count and their names, never what they said.
type Params = { params: Promise<{ seasonId: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await watchCard(user, seasonId, new URL(req.url).searchParams.get("couch")));
});
