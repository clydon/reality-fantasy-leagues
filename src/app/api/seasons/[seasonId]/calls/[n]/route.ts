import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { callEpisode, episodeCalls } from "@/lib/server/calls";

// Call it (docs/PLAN-new-design.md step 12 part 2; calls.ts), on a couch (`?couch=`; without one, or on a couch of one, the
// calls are just yours):
//   GET   an episode's calls: the questions, yours, how many on the couch have called it; once it's aired and you've seen it,
//         how each call stands and the couch's calls
//   POST  { calls: { [question]: answer | null } } before it airs, or { said: { [question]: "yes" | "no" | null } } once you've
//         seen it (a talk show's calls, which the couch settles); answers the episode's calls
// 409 for an episode that isn't open (and hasn't aired), 403 to call while behind or to say what happened before seeing it.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await episodeCalls(user, seasonId, new URL(req.url).searchParams.get("couch"), n));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { calls?: unknown; said?: unknown };
  return NextResponse.json(await callEpisode(user, seasonId, new URL(req.url).searchParams.get("couch"), n, body));
});
