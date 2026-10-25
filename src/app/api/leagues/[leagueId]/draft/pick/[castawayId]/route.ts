import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { plainChange } from "@/lib/server/change-log";

// Port of SurvivorDraft's server/routes/draft.js DELETE /pick/:castawayId -- commissioner-only.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; castawayId: string }> }) => {
  const { leagueId, castawayId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.undraft(s, castawayId);
  }, plainChange(user.id, "draft", "Took back a draft pick", 2));
  return NextResponse.json(state);
});
