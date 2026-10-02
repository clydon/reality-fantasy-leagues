import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js POST /players -- commissioner-only. Adds a seat with
// no account behind it: one the commissioner plays for, or a computer player.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  // automated: a computer player (src/lib/game/bot-logic.js) rather than a seat the commissioner fills in.
  const { name, automated } = (await req.json().catch(() => ({}))) as { name?: string; automated?: boolean };
  if (!name) throw new HttpError(400, "name required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.addPlayer(s, name, { automated: automated === true });
  });
  return NextResponse.json(state);
});
