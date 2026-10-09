import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyMidSeasonTurn } from "@/lib/server/push-events";

// Port of SurvivorDraft's server/routes/replenish.js POST /start -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, (s) => {
    // Replenish is opt-in and off by default, and shared-ownership leagues can't run it at all --
    // check here too rather than trusting the UI to have hidden the button.
    if (!StateLogic.replenishAvailable(s)) throw new HttpError(400, "Pickups aren't turned on for this league");
    if (!StateLogic.startReplenish(s)) {
      throw new HttpError(
        400,
        StateLogic.getLeagueType(s).hasActiveRoster
          ? `Nobody's roster is down to ${StateLogic.MidSeasonLogic.replenishAt(s)} still in the game.`
          : "Nobody has an eliminated castaway to replace yet."
      );
    }
  });
  notifyMidSeasonTurn(leagueId, state, user.id);
  return NextResponse.json(state);
});
