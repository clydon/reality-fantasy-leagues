import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyMidSeasonTurn } from "@/lib/server/push-events";

// Port of SurvivorDraft's server/routes/trade.js POST /skip. A member acts on their own turn; the
// commissioner starts the round and can act for anyone (same rule as draft/pick).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");

  const state = await withLeagueLock(leagueId, (s) => {
    const t = s.midSeason.trade;
    if (!t || t.index >= t.queue.length) throw new HttpError(400, "No swap round is running");
    if (membership.role !== "commissioner" && t.queue[t.index].playerId !== membership.playerId) {
      throw new HttpError(403, "It's not your turn");
    }
    StateLogic.tradeSkip(s);
  });
  notifyMidSeasonTurn(leagueId, state, user.id);
  return NextResponse.json(state);
});
