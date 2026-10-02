import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { applyHeldTribesIfDue } from "@/lib/server/season-cast";
import { notifyEpisodeResults } from "@/lib/server/push-events";

// Port of SurvivorDraft's server/routes/episodes.js POST /:epId/eliminations -- commissioner-only.
// Pushes the result to the rest of the league (no chat line any more -- see migration 0040).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { castawayId, method, juryVotes } = (await req.json().catch(() => ({}))) as {
    castawayId?: string;
    method?: string;
    juryVotes?: number | null;
  };
  if (!castawayId || !method) throw new HttpError(400, "castawayId and method required");
  if (juryVotes != null && !(Number.isInteger(juryVotes) && juryVotes >= 0)) throw new HttpError(400, "juryVotes must be a whole number");

  const state = await withLeagueLock(leagueId, async (s, client) => {
    StateLogic.addElimination(s, epId, castawayId, method, juryVotes ?? null);
    // Logging a result can be the moment a live league reaches the episode the tribes were held for.
    await applyHeldTribesIfDue(client, s);
  });

  const ep = state.episodes.find((e) => e.id === epId);
  const castaway = castawayId ? StateLogic.getCastaway(state, castawayId) : null;
  if (ep && castaway) {
    notifyEpisodeResults(leagueId, state, epId, user.id);
  }

  return NextResponse.json(state);
});
