import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Pick'em only: clears the given player's pick for this episode. Same self-or-commissioner shape
// as DELETE .../bets/:betId/predictions/:predId -- a member can remove only their own pick,
// commissioner/super-admin can remove anyone's.
export const DELETE = apiRoute(
  async (req, { params }: { params: Promise<{ leagueId: string; epId: string; playerId: string }> }) => {
    const { leagueId, epId, playerId } = await params;
    const { membership } = await requireLeagueRole(req, leagueId, "member");
    if (membership.role !== "commissioner" && playerId !== membership.playerId) {
      throw new HttpError(403, "You can only remove your own pick");
    }

    const state = await withLeagueLock(leagueId, (s) => {
      StateLogic.removePickEmPick(s, epId, playerId);
    });
    return NextResponse.json(state);
  }
);
