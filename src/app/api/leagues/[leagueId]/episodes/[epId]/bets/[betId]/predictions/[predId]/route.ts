import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError, insertSystemMessage } from "@/lib/server/db";

type RouteParams = { leagueId: string; epId: string; betId: string; predId: string };

// Port of SurvivorDraft's server/routes/episodes.js DELETE /:epId/bets/:betId/predictions/:predId
// -- a member can remove only their own guess; commissioner/super-admin can remove anyone's.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, epId, betId, predId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");

  const state = await withLeagueLock(leagueId, (s) => {
    const ep = s.episodes.find((e) => e.id === epId);
    const bet = ep && (ep.bets || []).find((b) => b.id === betId);
    const pred = bet && bet.predictions.find((p) => p.id === predId);
    if (pred && membership.role !== "commissioner" && pred.playerId !== membership.playerId) {
      throw new HttpError(403, "You can only remove your own guess");
    }
    StateLogic.removeBetPrediction(s, epId, betId, predId);
  });
  return NextResponse.json(state);
});

// Port of the same file's PATCH /:epId/bets/:betId/predictions/:predId -- commissioner-only
// grading. Push-notification-on-resolved-bet isn't ported (out of scope); the chat system-message
// feed entry is.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, epId, betId, predId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { value } = (await req.json().catch(() => ({}))) as { value?: boolean | null };

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.setBetPredictionCorrect(s, epId, betId, predId, value ?? null);
  });

  if (value === true || value === false) {
    const ep = state.episodes.find((e) => e.id === epId);
    const bet = ep && (ep.bets || []).find((b) => b.id === betId);
    const pred = bet && bet.predictions.find((p) => p.id === predId);
    const player = pred ? StateLogic.getPlayer(state, pred.playerId) : null;
    if (bet && player) {
      const verb = value ? "correctly guessed" : "incorrectly guessed";
      insertSystemMessage(leagueId, `${player.name} ${verb} on "${bet.label}"`).catch(() => {});
    }
  }

  return NextResponse.json(state);
});
