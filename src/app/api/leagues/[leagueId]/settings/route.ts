import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js PATCH /settings -- generic field/value setter,
// no per-field validation server-side (same as the original; the client only ever sends fields
// StateLogic.updateSettings already understands).
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.updateSettings(s, field, value);
  });
  return NextResponse.json(state);
});
