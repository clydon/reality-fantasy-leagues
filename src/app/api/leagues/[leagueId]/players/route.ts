import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js POST /players -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name) throw new HttpError(400, "name required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.addPlayer(s, name);
  });
  return NextResponse.json(state);
});
