import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { dropBlindPicksForPlayer } from "@/lib/server/blind-draft";

// Port of SurvivorDraft's server/routes/roster.js PATCH/DELETE /players/:id -- commissioner-only.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.updatePlayer(s, id, field, value);
  });
  return NextResponse.json(state);
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const state = await withLeagueLock(leagueId, async (s, client) => {
    StateLogic.removePlayer(s, id);
    // The seat is gone, so any blind-draft submission it made is meaningless -- and left behind it
    // would keep an unrevealed draft waiting on a player who no longer exists. Same transaction as
    // the state write so the two can't diverge. (Disabling a seat rather than deleting it keeps its
    // submission; see dropBlindPicksForPlayer's comment.)
    await dropBlindPicksForPlayer(client, leagueId, id);
    StateLogic.BlindDraftLogic.setLockedPlayerIds(
      s,
      StateLogic.BlindDraftLogic.lockedPlayerIds(s).filter((pid) => pid !== id)
    );
  });
  return NextResponse.json(state);
});
