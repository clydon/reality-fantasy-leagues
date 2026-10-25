import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { requireWaivers, waiverActor } from "@/lib/server/waiver-actor";

// A free-agency move (docs/PLAN-midseason-waivers.md): after waivers process, until the next episode
// airs. Instant, first come, first served, and it never changes the waiver order. Body { addId, dropId }:
// dropping someone out of the game replaces them, someone still in is a swap (docs/PLAN-waivers-v2.md).
// { addId } alone (pre-v2, one release) replaces your oldest loss. `playerId`: the commissioner acting
// for someone. Two people tapping the same free agent serialize on the league lock: the second is told
// they've gone.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { playerId?: unknown; addId?: unknown; dropId?: unknown };
  if (typeof body.addId !== "string" || !body.addId) throw new HttpError(400, "addId required");
  const addId = body.addId;
  const dropId = typeof body.dropId === "string" && body.dropId ? body.dropId : null;

  const state = await withLeagueLock(leagueId, async (s) => {
    requireWaivers(s);
    const playerId = await waiverActor(user.id, leagueId, membership, s, body.playerId);
    const refused = StateLogic.WaiverLogic.freeAgencyMove(s, playerId, addId, dropId, Date.now());
    if (refused) throw new HttpError(refused.startsWith("They’re not a free agent") ? 409 : 400, refused);
  });
  return stateResponse(req, state);
});
