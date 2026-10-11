import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { refuseWhileCatchingUp } from "@/lib/server/late-join";

// Port of SurvivorDraft's server/routes/episodes.js POST /:epId/bets/:betId/predictions -- any
// member can add their own guess; commissioner/super-admin can add on anyone's behalf.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; betId: string }> }) => {
  const { leagueId, epId, betId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const { playerId, guess } = (await req.json().catch(() => ({}))) as { playerId?: string; guess?: string };
  if (membership.role !== "commissioner" && playerId !== membership.playerId) {
    throw new HttpError(403, "You can only submit a guess for yourself");
  }
  if (!playerId || !guess) throw new HttpError(400, "playerId and guess required");

  const state = await withLeagueLock(leagueId, (s) => {
    refuseWhileCatchingUp(s, playerId, "Predictions");
    StateLogic.addBetPrediction(s, epId, betId, playerId, guess);
  });
  return NextResponse.json(state);
});
