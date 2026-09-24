import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError, insertSystemMessage } from "@/lib/server/db";
import { notifyEpisodeResults } from "@/lib/server/push-events";

// Port of SurvivorDraft's server/routes/episodes.js POST /:epId/eliminations -- commissioner-only.
// Posts the chat system message and pushes the result to the rest of the league.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { castawayId, method } = (await req.json().catch(() => ({}))) as { castawayId?: string; method?: string };
  if (!castawayId || !method) throw new HttpError(400, "castawayId and method required");

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.addElimination(s, epId, castawayId, method);
  });

  const ep = state.episodes.find((e) => e.id === epId);
  const castaway = castawayId ? StateLogic.getCastaway(state, castawayId) : null;
  if (ep && castaway) {
    const text = `${castaway.name} — ${castaway.exitMethod} (Episode ${ep.number})`;
    insertSystemMessage(leagueId, text).catch(() => {});
    notifyEpisodeResults(leagueId, state, epId, user.id);
  }

  return NextResponse.json(state);
});
