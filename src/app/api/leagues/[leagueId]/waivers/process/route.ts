import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { processNow } from "@/lib/server/waivers";
import { requireWaivers } from "@/lib/server/waiver-actor";

// The commissioner's Process now (docs/PLAN-midseason-waivers.md): runs every claim that's in, at once,
// and opens free agency early. Commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, async (s, client) => {
    requireWaivers(s);
    const refused = await processNow(client, leagueId, s);
    if (refused) throw new HttpError(400, refused);
  });
  return NextResponse.json(state);
});
