import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { requireWaivers } from "@/lib/server/waiver-actor";
import { plainChange } from "@/lib/server/change-log";

// The commissioner's Undo last waiver run (docs/PLAN-midseason-waivers.md), for when results were
// applied by mistake: while free agency is still open, every castaway goes back (that week's free-agency
// moves too), the waiver order is restored, and claims reopen as they were -- held until Process now,
// or at the latest when the next episode airs. Commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, (s) => {
    requireWaivers(s);
    const refused = StateLogic.WaiverLogic.undo(s);
    if (refused) throw new HttpError(400, refused);
  }, plainChange(user.id, "waivers", "Took back the last waiver run", 2));
  return NextResponse.json(state);
});
