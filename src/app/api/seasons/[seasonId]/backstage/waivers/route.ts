import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { waiversAdmin, waiverWrite, type WaiverAction } from "@/lib/server/backstage-games";

// Backstage › Waivers (docs/PLAN-new-design.md step 6a), for whoever runs a game here (a Game admin too): each game's
// week, who has picks in (never what they are), the last run, and how waivers work. POST `{ leagueId, action, ... }`:
// window (open, change or turn off: `swaps`, `replace`), preview (tier 2: what Run now does, with nothing private in it),
// run, undo (a run the hourly job made), feel or set (how waivers work: a Commissioner's). Answers the batch in Recent
// changes, for the toast's Undo.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  return NextResponse.json(await waiversAdmin(scope));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as WaiverAction & { leagueId?: unknown };
  return NextResponse.json(await waiverWrite(scope, body.leagueId, body));
});
