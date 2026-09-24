import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Active Roster only, commissioner-only: freeze this episode's lineups (POST) or reopen them
// (DELETE). Explicitly a commissioner action rather than something derived from whether the episode
// has eliminations logged yet -- the lock is meant to land BEFORE the episode airs, while
// eliminations are entered after, so deriving it would leave a window in which a player could
// rewrite their lineup already knowing the outcome. See ActiveRosterLogic's comment.
//
// Reopening exists because a commissioner who locks a week early (or before someone had a chance to
// set theirs) otherwise has no way back; it's deliberately commissioner-only for the same reason.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, (s) => {
    if (!StateLogic.getLeagueType(s).hasActiveRoster) throw new HttpError(400, "This league type has no active roster");
    if (!StateLogic.lockActiveRosterLineups(s, epId)) throw new HttpError(400, "Lineups are already locked");
  });
  return NextResponse.json(state);
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, (s) => {
    if (!StateLogic.getLeagueType(s).hasActiveRoster) throw new HttpError(400, "This league type has no active roster");
    if (!StateLogic.unlockActiveRosterLineups(s, epId)) throw new HttpError(400, "Lineups aren't locked");
  });
  return NextResponse.json(state);
});
