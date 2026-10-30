import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { catchingUpMark } from "@/lib/server/late-join";
import { forPlayerChange } from "@/lib/server/change-log";

// Pick'em only: clears the given player's pick for this episode. Same self-or-commissioner shape
// as DELETE .../bets/:betId/predictions/:predId -- a member can remove only their own pick,
// commissioner/super-admin can remove anyone's. `?second` clears only a pool's second pick (step A10 part 2).
export const DELETE = apiRoute(
  async (req, { params }: { params: Promise<{ leagueId: string; epId: string; playerId: string }> }) => {
    const { leagueId, epId, playerId } = await params;
    const { user, membership } = await requireLeagueRole(req, leagueId, "member");
    if (membership.role !== "commissioner" && playerId !== membership.playerId) {
      throw new HttpError(403, "You can only remove your own pick");
    }

    const opts = new URL(req.url).searchParams.has("second") ? { second: true } : undefined;
    const state = await withLeagueLock(leagueId, async (s) => {
      const mark = await catchingUpMark(leagueId, s, playerId);
      if (mark !== null) {
        const problem = StateLogic.GhostLogic.applyAs(s, playerId, mark, epId, (v) => StateLogic.removePickEmPick(v, epId, playerId, opts));
        if (problem) throw new HttpError(400, problem);
        return;
      }
      StateLogic.removePickEmPick(s, epId, playerId, opts);
    }, forPlayerChange(user.id, membership.playerId, playerId, "pick", (name) => (opts ? `Cleared ${name}'s second pick` : `Cleared ${name}'s pick`), { kind: "pick", episodeId: epId }));
    return NextResponse.json(state);
  }
);
