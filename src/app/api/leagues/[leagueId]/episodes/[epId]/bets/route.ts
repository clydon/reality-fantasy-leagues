import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/episodes.js POST /:epId/bets -- any member can propose a
// bet, not just the commissioner. Push-notification-on-new-bet isn't ported (out of scope).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const { label, points } = (await req.json().catch(() => ({}))) as { label?: string; points?: number };
  if (!label || !label.trim()) throw new HttpError(400, "label required");
  if (typeof points !== "number") throw new HttpError(400, "points required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.addBet(s, epId, label, points, membership.playerId);
  });
  return NextResponse.json(state);
});
