import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { leagueCastWrite } from "@/lib/server/season-cast-write";

// Port of SurvivorDraft's server/routes/roster.js POST /castaways -- commissioner-only. On a league
// with a season, adding someone adds them to the SEASON's cast (season-cast-write.ts).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name) throw new HttpError(400, "name required");

  const { state } = await leagueCastWrite(leagueId, user.id, { type: "add", name }, (s) => {
    StateLogic.addCastaway(s, name);
  });
  return NextResponse.json(state);
});
