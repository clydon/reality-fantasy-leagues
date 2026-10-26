import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { sessionWrite } from "@/lib/server/watch-along";

// Your watch along's clock, kept for the couch's "who's on now" (docs/PLAN-new-design.md step 13 part 2; watch-along.ts
// sessionWrite, watch-sessions.ts), on a couch (`?couch=`; alone, nothing's kept):
//   POST { at, mode: 'stream' | 'live', running, ad }   it started, paused, went to an ad break or moved
//   POST { beat: true }                                  it's still open (a paused watch along, every 20 s for ten minutes)
//   POST { at, leave: true }                             it closed or ended
// Each answers { session, now }: who else on the couch is watching that episode along right now. 403 past your next episode,
// 409 before it's aired.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof sessionWrite>[4];
  return NextResponse.json(await sessionWrite(user, seasonId, new URL(req.url).searchParams.get("couch"), n, body));
});
