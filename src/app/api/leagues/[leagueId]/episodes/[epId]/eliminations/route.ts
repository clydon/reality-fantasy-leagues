import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError, insertSystemMessage } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/episodes.js POST /:epId/eliminations -- commissioner-only.
// Push-notification-on-elimination isn't ported (out of scope -- see the standalone-backend
// plan); the chat system-message feed entry is, since chat itself is in scope.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
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
  }

  return NextResponse.json(state);
});
