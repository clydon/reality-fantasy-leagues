import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Undoes someone's tribe/team change in this episode; their group falls back to the one before it.
// Commissioner-only.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; castawayId: string }> }) => {
  const { leagueId, epId, castawayId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.removeGroupChange(s, epId, castawayId);
  });
  return NextResponse.json(state);
});
