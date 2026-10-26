import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { planNight, planOptions } from "@/lib/server/watch-plans";

// Planned nights (docs/PLAN-new-design.md step 11 part 3; watch-plans.ts), on a couch (`?couch=`).
//   GET   what can be planned: the episodes from your next (when each is out, whether its live airing can be), everyone
//         else on the couch and whether they watch it, and the couch's plans for the season still to come
//   POST  { episode, how: "live" | "start", startsAt (a shared start), invite: [userIds] }: plan it; one push to those
//         invited. -> { plan, plans, told }
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await planOptions(user, seasonId, new URL(req.url).searchParams.get("couch")));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; how?: unknown; startsAt?: unknown; invite?: unknown };
  return NextResponse.json(await planNight(user, seasonId, new URL(req.url).searchParams.get("couch"), body));
});
