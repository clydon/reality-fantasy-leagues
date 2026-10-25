import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { plainChange } from "@/lib/server/change-log";

// Port of SurvivorDraft's server/routes/finale.js PATCH /actual/top3 -- commissioner-only.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { idx, value } = (await req.json().catch(() => ({}))) as { idx?: number; value?: string | null };
  if (typeof idx !== "number") throw new HttpError(400, "idx required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.setActualTop3(s, idx, value ?? null);
  }, plainChange(user.id, "results", "Entered the finale's results", 2));
  return NextResponse.json(state);
});
