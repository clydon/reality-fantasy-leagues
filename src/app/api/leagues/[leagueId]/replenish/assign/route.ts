import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyMidSeasonTurn } from "@/lib/server/push-events";

// Port of SurvivorDraft's server/routes/replenish.js POST /assign. A member makes their own pick on
// their turn; the commissioner starts the round and can pick for anyone (same rule as draft/pick).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const { castawayId } = (await req.json().catch(() => ({}))) as { castawayId?: string };
  if (!castawayId) throw new HttpError(400, "castawayId required");

  const state = await withLeagueLock(leagueId, (s) => {
    const turn = StateLogic.currentReplenishTurn(s);
    if (!turn || turn.isComplete) throw new HttpError(400, "No pickup round is running");
    if (membership.role !== "commissioner" && turn.playerId !== membership.playerId) {
      throw new HttpError(403, "It's not your turn");
    }
    StateLogic.replenishAssign(s, castawayId);
  });
  notifyMidSeasonTurn(leagueId, state, user.id);
  return NextResponse.json(state);
});
