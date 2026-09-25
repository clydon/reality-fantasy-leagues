import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { applyHeldTribesIfDue } from "@/lib/server/season-cast";

// Active Roster only, commissioner-only: log one point-earning event for this episode (someone won
// immunity, found an idol, ...). Manual entry is the primary path and always will be -- the wiki
// connector (see docs/PLAN-league-types-and-wiki-connector.md, Feature D) is designed to propose
// events into this same log for the commissioner to confirm, not to replace this route.
//
// These are `scoringEvents`, NOT the `events` array on the same episode, which means eliminations --
// see ActiveRosterLogic.addEvent's note on why mixing them would break Pick'em and episode deletion.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { type, castawayId } = (await req.json().catch(() => ({}))) as { type?: string; castawayId?: string };
  if (!type || !castawayId) throw new HttpError(400, "type and castawayId required");

  const state = await withLeagueLock(leagueId, async (s, client) => {
    if (!StateLogic.getLeagueType(s).hasActiveRoster) throw new HttpError(400, "This league type has no scoring events");
    if (!StateLogic.addScoringEvent(s, epId, type, castawayId)) {
      throw new HttpError(400, "Unknown event type, episode or castaway");
    }
    await applyHeldTribesIfDue(client, s);
  });
  return NextResponse.json(state);
});
