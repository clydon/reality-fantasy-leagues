import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { togetherRead, togetherWrite } from "@/lib/server/watch-along";

// Watching together (docs/PLAN-new-design.md step 13 part 3; watch-along.ts, watch-sessions.ts): a planned night's watch along, one
// clock for everyone in it, on the night's couch (`?couch=`):
//   GET   ?plan=<id>&v=<version>&beat=1   the night's session: `{ version }` alone while `v` is still it (the open watch along asks
//         every few seconds), else the session (null before anyone's opened it) and who else on the couch is on the episode
//   POST  { plan, join: true }                                open it: you're in it (and in the night), out of your own
//   POST  { id, change, at, mode, running, ad }               start it ("3, 2, 1"), pause, resume, an ad break and back, or move it,
//                                                             for everyone in it (change: start, pause, resume, ad, show, move)
//   POST  { id, beat: true } | { id, leave: true }            still here; closed it
// 403 past your next episode or off the couch, 404 for a night that isn't this couch's episode, 409 for one called off, opening the
// live airing before it airs, starting a shared start more than 15 minutes early, or moving a clock you've left.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await togetherRead(user, seasonId, q.get("couch"), n, { plan: q.get("plan"), v: q.get("v"), beat: q.get("beat") === "1" }));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof togetherWrite>[4];
  return NextResponse.json(await togetherWrite(user, seasonId, new URL(req.url).searchParams.get("couch"), n, body));
});
