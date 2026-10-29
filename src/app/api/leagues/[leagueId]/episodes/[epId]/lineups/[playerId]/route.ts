import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { catchingUpMark } from "@/lib/server/late-join";
import { forPlayerChange } from "@/lib/server/change-log";

// Active Roster only: set which of a player's castaways are ACTIVE for this episode. A member sets
// their own; the commissioner can set anyone's, same shape as the bet-prediction and pick'em routes.
//
// Returns a real 400 with the reason on an invalid lineup (too many, not yours, episode locked)
// rather than silently no-opping the way most mutators here do -- a lineup the player thinks they
// set but didn't would quietly cost them points, so it has to fail loudly.
//
// `captainId` (docs/PLAN-start-a-game-gpt.md step A9 part 2, a game with a captain: its spec's score.captain): one of the
// lineup's starters, whose points multiply, or null for none; left out, the captain stays as it is. Set with the lineup it's
// one of and locked with it (ActiveRosterLogic.validateCaptain).
export const PUT = apiRoute(
  async (req, { params }: { params: Promise<{ leagueId: string; epId: string; playerId: string }> }) => {
    const { leagueId, epId, playerId } = await params;
    const { user, membership } = await requireLeagueRole(req, leagueId, "member");
    const body = (await req.json().catch(() => ({}))) as { castawayIds?: string[]; captainId?: string | null };
    const { castawayIds } = body;
    if (!Array.isArray(castawayIds)) throw new HttpError(400, "castawayIds required");
    const naming = Object.prototype.hasOwnProperty.call(body, "captainId");
    const captainId = naming ? body.captainId ?? null : undefined;
    if (naming && captainId !== null && typeof captainId !== "string") throw new HttpError(400, "captainId is a castaway's id, or null");
    if (membership.role !== "commissioner" && playerId !== membership.playerId) {
      throw new HttpError(403, "You can only set your own lineup");
    }

    const problemIn = (v: LeagueState) =>
      StateLogic.ActiveRosterLogic.validateLineup(v, epId, playerId, castawayIds) ??
      (naming ? StateLogic.ActiveRosterLogic.validateCaptain(v, epId, playerId, captainId ?? null, castawayIds) : null);
    const write = (v: LeagueState) => {
      StateLogic.setActiveRosterLineup(v, epId, playerId, castawayIds);
      if (naming) StateLogic.setActiveRosterCaptain(v, epId, playerId, captainId ?? null);
    };
    const state = await withLeagueLock(leagueId, async (s) => {
      // A late joiner catching up (StateLogic.GhostLogic): their week, as they see the league.
      const mark = await catchingUpMark(leagueId, s, playerId);
      const problem =
        mark === null
          ? problemIn(s)
          : StateLogic.GhostLogic.applyAs(s, playerId, mark, epId, (v) => {
              const p = problemIn(v);
              if (p) return p;
              write(v);
              return null;
            });
      if (problem) throw new HttpError(400, problem);
      if (mark === null) write(s);
    }, forPlayerChange(user.id, membership.playerId, playerId, "lineup", (name) => `Set ${name}'s lineup`));
    return stateResponse(req, state);
  }
);
