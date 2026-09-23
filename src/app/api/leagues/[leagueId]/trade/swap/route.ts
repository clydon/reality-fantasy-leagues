import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/trade.js POST /swap -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { dropId, addId } = (await req.json().catch(() => ({}))) as { dropId?: string; addId?: string };
  if (!dropId || !addId) throw new HttpError(400, "dropId and addId required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.tradeSwap(s, dropId, addId);
  });
  return NextResponse.json(state);
});
