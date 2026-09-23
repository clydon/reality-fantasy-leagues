import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/replenish.js POST /start -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, (s) => {
    if (!StateLogic.startReplenish(s)) throw new HttpError(400, "No unclaimed losses to replenish");
  });
  return NextResponse.json(state);
});
