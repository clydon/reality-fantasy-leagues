import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { approvedCastFor, applyCastToState } from "@/lib/server/season-cast";
import { syncLeagueDecisions } from "@/lib/server/season-decisions";

// Port of SurvivorDraft's server/routes/roster.js PATCH /settings -- generic field/value setter,
// no per-field validation server-side (same as the original; the client only ever sends fields
// StateLogic.updateSettings already understands).
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");

  const state = await withLeagueLock(leagueId, async (s, client) => {
    StateLogic.updateSettings(s, field, value);

    // Picking a show or a season is the other moment a league should receive the season's
    // admin-approved cast (db/migrations/0011) -- approval itself covers the leagues already on the
    // season, and this covers the ones that arrive afterwards. Additive and idempotent
    // (applyCastImport), so a league that already has those castaways gains nothing and loses
    // nothing, and a season with no approved cast is simply a no-op.
    if (field === "revealedThroughEpisode") await syncLeagueDecisions(client, leagueId, s);
    if (field === "showId" || field === "wikiSeason") {
      const approved = await approvedCastFor(client, s.settings.showId, s.settings.wikiSeason);
      // The starting tribes ride along only if this league may see them yet -- a league catching up
      // from episode 0 gets the people now and the division when it reveals the premiere. See
      // tribesDue in season-cast.ts.
      if (approved) applyCastToState(s, approved.cast, approved.tribesFromEpisode);
      // ...and the season's admin-decided episode results with it, gated by this league's reveal
      // pointer. Switching to a different season undoes the old season's (its decisions no longer
      // belong to this league).
      await syncLeagueDecisions(client, leagueId, s);
    }
  });
  return NextResponse.json(state);
});
