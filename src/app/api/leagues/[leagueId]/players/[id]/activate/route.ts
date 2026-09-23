import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js POST /players/:id/activate -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { castawayIds } = (await req.json().catch(() => ({}))) as { castawayIds?: string[] };

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.activatePlayer(s, id, castawayIds ?? []);
  });
  return NextResponse.json(state);
});
