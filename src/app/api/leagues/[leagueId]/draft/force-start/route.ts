import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { notifyDraftTurn } from "@/lib/server/push-events";
import { plainChange } from "@/lib/server/change-log";

// Port of SurvivorDraft's server/routes/draft.js POST /force-start -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.forceStartDraft(s);
  }, plainChange(user.id, "draft", "Started the draft", 2));
  notifyDraftTurn(leagueId, state, user.id);
  return NextResponse.json(state);
});
