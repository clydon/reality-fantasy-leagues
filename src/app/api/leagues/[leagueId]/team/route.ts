import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { plainChange } from "@/lib/server/change-log";

// A game at your own pace with teams (docs/PLAN-own-pace-games.md part 3a): your own team, picked once, from who was still in
// before your start (StateLogic.GhostLogic.pickTeam: the late joiner's checks; shared teams, so nobody's taken from anyone).
//   POST { castawayIds }   -> the league's state, as the other move routes answer
// 400 with the reason (the wrong number, someone who'd gone by then, a team already picked, not a game at your own pace).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const { castawayIds } = (await req.json().catch(() => ({}))) as { castawayIds?: unknown };
  if (!Array.isArray(castawayIds) || !castawayIds.every((x) => typeof x === "string")) throw new HttpError(400, "castawayIds is a list");
  const playerId = membership.playerId;
  if (!playerId) throw new HttpError(403, "You don't have a seat in this game");
  const state = await withLeagueLock(
    leagueId,
    async (s) => {
      const problem = StateLogic.GhostLogic.pickTeam(s, playerId, castawayIds as string[]);
      if (problem) throw new HttpError(400, problem);
    },
    plainChange(user.id, "team", `${(user as { username?: string | null }).username || user.name} picked their team`)
  );
  return stateResponse(req, state);
});
