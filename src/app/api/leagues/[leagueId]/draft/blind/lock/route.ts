import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { lockBlindPicks } from "@/lib/server/blind-draft";

// Blind draft (shared-ownership classic-draft): submit a player's full set of picks and lock them
// in. If this submission completes the set -- every eligible player locked in -- the reveal happens
// inside this same transaction (see lockBlindPicks for why that atomicity matters).
//
// A member may lock in for themselves; the commissioner may also lock in on a player's behalf, so
// an absent player can't stall the draft indefinitely. Note the deliberate asymmetry with the GET
// on this route's [playerId] child: submitting for someone else is allowed, READING someone else's
// submission is not, not even for the commissioner -- see readOwnPicks' comment.
//
// Unlike most mutators in this app (which silently no-op on an invalid request), this returns a real
// 400 with the reason: the player can't see what anyone else did, so a silent no-op would be
// indistinguishable to them from a successful lock-in.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const { playerId, castawayIds } = (await req.json().catch(() => ({}))) as {
    playerId?: string;
    castawayIds?: string[];
  };
  if (!playerId || !Array.isArray(castawayIds)) throw new HttpError(400, "playerId and castawayIds required");
  if (membership.role !== "commissioner" && playerId !== membership.playerId) {
    throw new HttpError(403, "You can only lock in your own picks");
  }

  const state = await withLeagueLock(leagueId, async (s, client) => {
    const problem = StateLogic.BlindDraftLogic.validateSubmission(s, playerId, castawayIds);
    if (problem) throw new HttpError(400, problem);
    if (StateLogic.BlindDraftLogic.hasLocked(s, playerId)) {
      throw new HttpError(400, "Already locked in — withdraw first to change your picks");
    }
    await lockBlindPicks(client, leagueId, s, playerId, castawayIds);
  });
  return NextResponse.json(state);
});
