import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { refuseWhileCatchingUp } from "@/lib/server/late-join";
import { finaleLock } from "@/lib/server/answer-points";

// Port of SurvivorDraft's server/routes/finale.js PATCH /predictions/:playerId/winner -- same
// own-pick-or-commissioner rule as the top-3 route.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; playerId: string }> }) => {
  const { leagueId, playerId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner" && playerId !== membership.playerId) {
    throw new HttpError(403, "You can only set your own prediction");
  }
  const { value } = (await req.json().catch(() => ({}))) as { value?: string | null };

  // Locked when the season's last episode starts, and once the results settle them (step A4).
  const locked = await finaleLock(leagueId);
  const state = await withLeagueLock(leagueId, (s) => {
    refuseWhileCatchingUp(s, playerId, "Finale predictions");
    locked(s);
    StateLogic.setFinaleWinnerPick(s, playerId, value ?? null);
  });
  return NextResponse.json(state);
});
