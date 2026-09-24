import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyMidSeasonTurn } from "@/lib/server/push-events";

// Port of SurvivorDraft's server/routes/trade.js POST /start -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, (s) => {
    // Opt-in and off by default, and unavailable in shared ownership -- same reasoning as
    // replenish/start's own guard.
    if (!StateLogic.tradeAvailable(s)) throw new HttpError(400, "Swap isn't enabled for this league");
    StateLogic.startTrade(s);
  });
  notifyMidSeasonTurn(leagueId, state, user.id);
  return NextResponse.json(state);
});
