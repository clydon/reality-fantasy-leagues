import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/draft.js POST /order -- commissioner-only pre-draft
// reordering.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { fromIndex, toIndex } = (await req.json().catch(() => ({}))) as { fromIndex?: number; toIndex?: number };
  if (typeof fromIndex !== "number" || typeof toIndex !== "number") throw new HttpError(400, "fromIndex and toIndex required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.reorderDraft(s, fromIndex, toIndex);
  });
  return NextResponse.json(state);
});
