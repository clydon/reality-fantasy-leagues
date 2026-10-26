import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { gifsFor } from "@/lib/server/gifs";
import { sayAt, watchRead } from "@/lib/server/watch-along";

// Watch along on an episode (docs/PLAN-new-design.md step 13 part 1; watch-along.ts), on a couch (`?couch=`; without one, or on a
// couch of one, it's just yours):
//   GET   ?at=<ms>&since=<ms>&open=1&beat=1   the reactions between two moments: the couch's from just after `since` through 30 s
//         before `at` (where your clock is), yours through `at`; `open` adds the pins and the couch's count. Polled while the clock
//         runs, with `beat`: the poll is your watch along's heartbeat (step 13 part 2), and every answer says who else is on it now.
//         Watching together (step 13 part 3), `together=<session>&sv=<version>`: the poll carries the session's version (and the
//         session when it's moved on), and what its people said in it comes through your clock, without the 30 s wait.
//   POST  { at, kind: 'text' | 'gif' | 'fire' | 'laugh' | 'eye' | 'crown', text?, gif? }: say something at that moment
// 403 for an episode past your next one; 409 for one with no air time, or saying something before it's aired.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await watchRead(user, seasonId, q.get("couch"), n, { at: q.get("at"), since: q.get("since"), open: q.get("open") === "1", beat: q.get("beat") === "1", together: q.get("together"), sv: q.get("sv") }, !!gifsFor(req)));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { at?: unknown; kind?: unknown; text?: unknown; gif?: unknown };
  return NextResponse.json({ reaction: await sayAt(user, seasonId, new URL(req.url).searchParams.get("couch"), n, body, gifsFor(req)) });
});
