import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { plainChange } from "@/lib/server/change-log";

// Commissioner-only: brings a late joiner into the league (StateLogic.GhostLogic.convert). From here on
// everyone sees them, team and points included. If they're still catching up, they keep doing so.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const state = await withLeagueLock(leagueId, (s) => {
    if (!StateLogic.GhostLogic.convert(s, id)) throw new HttpError(400, "That player isn't a late joiner");
  }, plainChange(user.id, "players", "Moved a late joiner into the game"));
  return NextResponse.json(state);
});
