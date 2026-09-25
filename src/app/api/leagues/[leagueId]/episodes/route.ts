import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/episodes.js POST / -- commissioner-only.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");

  // An optional explicit number, for catch-up mode: its "Open episode N" control opens the episode
  // whose results haven't been revealed yet, which isn't necessarily max+1 (a league can have added
  // episodes by hand). Without a number this is the original behaviour -- append the next one.
  const body = (await req.json().catch(() => ({}))) as { number?: number };
  const wanted = Number(body.number);

  const state = await withLeagueLock(leagueId, (s) => {
    if (Number.isInteger(wanted) && wanted > 0) StateLogic.ensureEpisodeNumber(s, wanted, false);
    else StateLogic.addEpisode(s);
  });
  return NextResponse.json(state);
});
