import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyNewBet } from "@/lib/server/push-events";
import { plainChange } from "@/lib/server/change-log";

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
    if (bet) return;
    // A bet goes on an episode the game plays: never after a span's last one, or before its start (BetLogic.add).
    // One waiting for its phase (step A3 of docs/PLAN-start-a-game-gpt.md) takes them once it's started.
    if (epId === "upcoming" && StateLogic.betTarget(s) === null) {
      throw new HttpError(409, StateLogic.waitsForPhase(s) && !StateLogic.gameOver(s) ? "This game hasn't started: predictions open once it does" : "This game is over: no new predictions");
    }
    if (s.episodes.some((e) => e.id === epId)) throw new HttpError(409, "This game doesn't play that episode, so no prediction goes on it");
    throw new HttpError(404, "Episode not found");
  }, plainChange(user.id, "predictions", "Added a prediction question"));
  notifyNewBet(leagueId, label.trim(), user.id);
  return NextResponse.json(state);
});
