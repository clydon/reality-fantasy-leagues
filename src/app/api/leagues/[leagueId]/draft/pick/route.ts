import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/draft.js POST /pick -- a member may only draft on their
// own turn; commissioner/super-admin can act for anyone. Push-notification-on-next-turn isn't
// ported (push notifications aren't part of this repo's scope yet -- see the standalone-backend
// plan's "out of scope" note).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const { castawayId } = (await req.json().catch(() => ({}))) as { castawayId?: string };
  if (!castawayId) throw new HttpError(400, "castawayId required");

  const state = await withLeagueLock(leagueId, (s) => {
    if (!StateLogic.isDraftStarted(s)) throw new HttpError(400, "Draft hasn't started yet");
    const turn = StateLogic.currentDraftTurn(s);
    if (!turn || turn.isComplete) throw new HttpError(400, "Draft is not active");
    if (membership.role !== "commissioner" && turn.playerId !== membership.playerId) {
      throw new HttpError(403, "It's not your turn");
    }
    StateLogic.draftToCurrentTurn(s, castawayId);
  });
  return NextResponse.json(state);
});
