import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { resultsChange } from "@/lib/server/change-log";

// Undoes a role recorded for someone in this episode. Commissioner-only.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; castawayId: string }> }) => {
  const { leagueId, epId, castawayId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.removeRole(s, epId, castawayId);
  }, resultsChange(user.id, { epId }, (n) => `Changed Episode ${n}'s results`));
  return NextResponse.json(state);
});
