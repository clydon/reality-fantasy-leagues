import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { readOwnPicks, unlockBlindPicks } from "@/lib/server/blind-draft";

type RouteParams = { leagueId: string; playerId: string };

// Your OWN locked-in picks, so the UI can still show them after a page refresh (they aren't in
// league state -- that's the whole point of blind draft, see src/lib/server/blind-draft.ts).
//
// SELF-ONLY, and deliberately NOT commissioner-readable: this is the one spot where blind draft
// overrides this app's usual "commissioner can do anything on anyone's behalf" rule, because a
// commissioner is normally also a player and reading everyone's submissions pre-reveal would hand
// them perfect information and defeat the mechanic outright. A super-admin with no seat in the
// league has no playerId at all and so can't match either.
export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, playerId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (!membership.playerId || playerId !== membership.playerId) {
    throw new HttpError(403, "You can only view your own blind-draft picks");
  }
  const castawayIds = await readOwnPicks(leagueId, playerId);
  return NextResponse.json({ castawayIds });
});

// Withdraw a not-yet-revealed submission so it can be redone (a misclick shouldn't need a whole
// league reset). Self-or-commissioner, same as locking in.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, playerId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner" && playerId !== membership.playerId) {
    throw new HttpError(403, "You can only withdraw your own picks");
  }

  const state = await withLeagueLock(leagueId, async (s, client) => {
    // Nothing to withdraw from once the reveal has happened -- ownership is in ownerIds by then, and
    // unwinding it is a commissioner job (undraft/reset), not a self-serve one.
    if (StateLogic.BlindDraftLogic.isRevealed(s)) {
      throw new HttpError(400, "The draft has already been revealed");
    }
    await unlockBlindPicks(client, leagueId, s, playerId);
  });
  return NextResponse.json(state);
});
