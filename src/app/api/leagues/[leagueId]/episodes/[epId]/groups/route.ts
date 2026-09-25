import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Records by hand that someone changed tribe/team this episode (a swap, the merge, new teams, a new
// partner) -- the commissioner's path for a league the season's admin decisions don't cover, same as
// logging an elimination by hand. A blank group means they now play on their own. Commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { castawayId, group } = (await req.json().catch(() => ({}))) as { castawayId?: string; group?: string | null };
  if (!castawayId) throw new HttpError(400, "castawayId required");
  const name = String(group ?? "").trim();
  if (name.length > 60) throw new HttpError(400, "That group name is too long");

  const state = await withLeagueLock(leagueId, (s) => {
    if (!StateLogic.addGroupChange(s, epId, castawayId, name || null)) {
      throw new HttpError(400, "Couldn't record that move -- they may already have one this episode");
    }
  });
  return NextResponse.json(state);
});
