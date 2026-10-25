import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { processNow } from "@/lib/server/waivers";
import { requireWaivers } from "@/lib/server/waiver-actor";
import { plainChange } from "@/lib/server/change-log";

// The commissioner's Process now (docs/PLAN-midseason-waivers.md): runs every claim that's in, at once,
// and opens free agency early. Commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, async (s, client) => {
    requireWaivers(s);
    const refused = await processNow(client, leagueId, s);
    if (refused) throw new HttpError(400, refused);
  }, plainChange(user.id, "waivers", "Ran waivers", 2));
  return NextResponse.json(state);
});
