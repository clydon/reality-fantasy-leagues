import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { answerCouchMoment, couchMoments } from "@/lib/server/couch-answers";

// The couch's own moments in an episode (docs/PLAN-new-design.md step 6b part 3), once you've seen it: GET them with your
// answer and what's settled ({ moments: [] } when the couch has none); POST `{ moment, picks: [{ name, times? }] }`, your
// answer, after which what's settled goes into the couch's games.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const view = await couchMoments(user, seasonId, new URL(req.url).searchParams.get("couch"), Number(n));
  return NextResponse.json(view ?? { episode: Number(n), moments: [], cast: [], runs: false });
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await answerCouchMoment(user, seasonId, new URL(req.url).searchParams.get("couch"), Number(n), await req.json().catch(() => ({}))));
});
