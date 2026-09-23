import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js PATCH/DELETE /castaways/:id -- commissioner-only.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.updateCastaway(s, id, field, value);
  });
  return NextResponse.json(state);
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.removeCastaway(s, id);
  });
  return NextResponse.json(state);
});
