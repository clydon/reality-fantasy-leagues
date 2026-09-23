import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js POST /tribes -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { name, color } = (await req.json().catch(() => ({}))) as { name?: string; color?: string };
  if (!name) throw new HttpError(400, "name required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.addTribe(s, name, color || "#45a89a");
  });
  return NextResponse.json(state);
});
