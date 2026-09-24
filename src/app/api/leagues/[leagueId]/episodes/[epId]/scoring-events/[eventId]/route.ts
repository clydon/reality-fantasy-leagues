import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock } from "@/lib/server/db";

// Active Roster only, commissioner-only: remove a logged scoring event (mis-entry, or a correction
// after the fact). Scores recompute from the log on read, so removing one just un-scores it -- there
// is no cached per-player total to invalidate.
export const DELETE = apiRoute(
  async (req, { params }: { params: Promise<{ leagueId: string; epId: string; eventId: string }> }) => {
    const { leagueId, epId, eventId } = await params;
    await requireLeagueRole(req, leagueId, "commissioner");

    const state = await withLeagueLock(leagueId, (s) => {
      StateLogic.removeScoringEvent(s, epId, eventId);
    });
    return NextResponse.json(state);
  }
);
