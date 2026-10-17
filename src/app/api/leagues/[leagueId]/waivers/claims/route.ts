import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { saveClaim } from "@/lib/server/waivers";
import { requireWaivers, waiverActor } from "@/lib/server/waiver-actor";

// Saves your claim for the open waiver week (docs/PLAN-waivers-v2.md): body { pairs: [{ addId, dropId }] },
// ranked, replacing the whole claim; empty withdraws it. The pre-v2 body { pickupIds, dropId, addIds } is
// still accepted for one release, saved by part (waivers.js saveClaim). `playerId` is the commissioner claiming for someone. The
// claim goes to waiver_claims, never into state -- what comes back is the league with its public
// "who has claims in" updated. Read yours back with GET /waivers.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { playerId?: unknown; pairs?: unknown; pickupIds?: unknown; dropId?: unknown; addIds?: unknown };

  const state = await withLeagueLock(leagueId, async (s, client) => {
    requireWaivers(s);
    const playerId = await waiverActor(user.id, leagueId, membership, s, body.playerId);
    const saved = await saveClaim(client, leagueId, s, playerId, body, user.id);
    if (saved.error) throw new HttpError(400, saved.error);
  });
  return NextResponse.json(state);
});
