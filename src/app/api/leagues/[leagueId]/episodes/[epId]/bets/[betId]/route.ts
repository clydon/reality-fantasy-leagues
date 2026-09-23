import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/episodes.js PATCH/DELETE /:epId/bets/:betId.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; betId: string }> }) => {
  const { leagueId, epId, betId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.updateBet(s, epId, betId, field, value);
  });
  return NextResponse.json(state);
});

// Commissioner can remove any bet; the bet's own creator can also remove it, but only while
// under 2 guesses -- once a bet is eligible to pay out, only the commissioner can pull it.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; betId: string }> }) => {
  const { leagueId, epId, betId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");

  const state = await withLeagueLock(leagueId, (s) => {
    const ep = s.episodes.find((e) => e.id === epId);
    const bet = ep && (ep.bets || []).find((b) => b.id === betId);
    if (!bet) return;
    const isCommissioner = membership.role === "commissioner";
    const isCreatorUnderThreshold =
      bet.createdByPlayerId && bet.createdByPlayerId === membership.playerId && (bet.predictions || []).length < 2;
    if (!isCommissioner && !isCreatorUnderThreshold) {
      throw new HttpError(403, "Only the commissioner, or the bet's creator before 2 guesses are in, can remove this bet");
    }
    StateLogic.removeBet(s, epId, betId);
  });
  return NextResponse.json(state);
});
