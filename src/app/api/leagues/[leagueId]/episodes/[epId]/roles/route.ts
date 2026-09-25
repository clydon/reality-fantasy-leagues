import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Records by hand that someone took on a secret role this episode (The Traitors: "Traitor" or
// "Recruited Traitor") -- the commissioner's path for a league the season's admin decisions don't
// cover, same as logging an elimination by hand. Commissioner-only. A later admin decision for the
// same person and episode finds it already there and leaves it alone.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { castawayId, role } = (await req.json().catch(() => ({}))) as { castawayId?: string; role?: string };
  if (!castawayId || !role) throw new HttpError(400, "castawayId and role required");

  const state = await withLeagueLock(leagueId, (s) => {
    // Refuses a role the league's show doesn't have, someone not in the league, or a second role for
    // the same person in the same episode.
    if (!StateLogic.addRole(s, epId, castawayId, role)) throw new HttpError(400, `Couldn't record "${role}" for that person here`);
  });
  return NextResponse.json(state);
});
