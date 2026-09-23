import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { withLeagueLock } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js POST /reset -- super-admin only (stricter than
// plain commissioner), wipes the league back to a fresh default state.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireSuperAdmin(req);

  const state = await withLeagueLock(leagueId, (s) => {
    const fresh = StateLogic.defaultState();
    Object.keys(s).forEach((k) => delete (s as unknown as Record<string, unknown>)[k]);
    Object.assign(s, fresh);
  });
  return NextResponse.json(state);
});
