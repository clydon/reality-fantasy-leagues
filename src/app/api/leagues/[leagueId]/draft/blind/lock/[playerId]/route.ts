import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { readOwnPicks } from "@/lib/server/blind-draft";
import { unlockBlindFor } from "@/lib/server/draft";

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
// league reset). Self, or whoever runs the game, same as locking in (draft.ts).
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, playerId } = await params;
  const actor = await requireLeagueRole(req, leagueId, "member");
  return NextResponse.json(await unlockBlindFor(actor, leagueId, playerId));
});
