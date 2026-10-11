import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { catchingUpMark } from "@/lib/server/late-join";

// Active Roster only: set which of a player's castaways are ACTIVE for this episode. A member sets
// their own; the commissioner can set anyone's, same shape as the bet-prediction and pick'em routes.
//
// Returns a real 400 with the reason on an invalid lineup (too many, not yours, episode locked)
// rather than silently no-opping the way most mutators here do -- a lineup the player thinks they
// set but didn't would quietly cost them points, so it has to fail loudly.
export const PUT = apiRoute(
  async (req, { params }: { params: Promise<{ leagueId: string; epId: string; playerId: string }> }) => {
    const { leagueId, epId, playerId } = await params;
    const { membership } = await requireLeagueRole(req, leagueId, "member");
    const { castawayIds } = (await req.json().catch(() => ({}))) as { castawayIds?: string[] };
    if (!Array.isArray(castawayIds)) throw new HttpError(400, "castawayIds required");
    if (membership.role !== "commissioner" && playerId !== membership.playerId) {
      throw new HttpError(403, "You can only set your own lineup");
    }

    const state = await withLeagueLock(leagueId, async (s) => {
      // A late joiner catching up (StateLogic.GhostLogic): their week, as they see the league.
      const mark = await catchingUpMark(leagueId, s, playerId);
      const problem =
        mark === null
          ? StateLogic.ActiveRosterLogic.validateLineup(s, epId, playerId, castawayIds)
          : StateLogic.GhostLogic.applyAs(s, playerId, mark, epId, (v) =>
              StateLogic.ActiveRosterLogic.validateLineup(v, epId, playerId, castawayIds) ?? StateLogic.setActiveRosterLineup(v, epId, playerId, castawayIds)
            );
      if (problem) throw new HttpError(400, problem);
      if (mark === null) StateLogic.setActiveRosterLineup(s, epId, playerId, castawayIds);
    });
    return NextResponse.json(state);
  }
);
