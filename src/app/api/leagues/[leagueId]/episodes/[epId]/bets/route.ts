import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyNewBet } from "@/lib/server/push-events";

// Port of SurvivorDraft's server/routes/episodes.js POST /:epId/bets -- any member can propose a
// bet, not just the commissioner. Pushes everyone else so they can guess.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const { label, points } = (await req.json().catch(() => ({}))) as { label?: string; points?: number };
  if (!label || !label.trim()) throw new HttpError(400, "label required");
  if (typeof points !== "number") throw new HttpError(400, "points required");

  // epId "upcoming" = whatever episode is about to be played (the Overview's "propose a bet"), created
  // if the league doesn't have it yet -- a new league has no episodes, and a bet proposed then used to
  // have nothing to attach to. See BetLogic.addToUpcoming.
  const state = await withLeagueLock(leagueId, (s) => {
    const bet =
      epId === "upcoming"
        ? StateLogic.addBetToUpcoming(s, label, points, membership.playerId)
        : StateLogic.addBet(s, epId, label, points, membership.playerId);
    if (!bet) throw new HttpError(404, "Episode not found");
  });
  notifyNewBet(leagueId, label.trim(), user.id);
  return NextResponse.json(state);
});
