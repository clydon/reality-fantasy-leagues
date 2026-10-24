import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { catchingUpMark } from "@/lib/server/late-join";

// Pick'em only: sets (or replaces) the caller's own weekly pick for this episode. Same
// self-or-commissioner permission shape as the classic-draft bet-prediction routes this is
// modeled on (POST .../bets/:betId/predictions) -- any member can submit their own pick,
// commissioner/super-admin can submit on anyone's behalf. Business-rule validation (castaway
// still active, no repeat of the immediately-previous episode's pick) lives in
// StateLogic.setPickEmPick and silently no-ops rather than erroring, matching this repo's
// existing convention (e.g. drafting an already-owned castaway is also a silent no-op) -- the
// frontend is expected to not offer the invalid options in the first place.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const { playerId, castawayId } = (await req.json().catch(() => ({}))) as { playerId?: string; castawayId?: string };
  if (membership.role !== "commissioner" && playerId !== membership.playerId) {
    throw new HttpError(403, "You can only set your own pick");
  }
  if (!playerId || !castawayId) throw new HttpError(400, "playerId and castawayId required");

  const state = await withLeagueLock(leagueId, async (s) => {
    // A late joiner catching up (StateLogic.GhostLogic): their week, as they see the league.
    const mark = await catchingUpMark(leagueId, s, playerId);
    if (mark === null) return StateLogic.setPickEmPick(s, epId, playerId, castawayId);
    const problem = StateLogic.GhostLogic.applyAs(s, playerId, mark, epId, (v) => StateLogic.setPickEmPick(v, epId, playerId, castawayId));
    if (problem) throw new HttpError(400, problem);
  });
  return stateResponse(req, state);
});
