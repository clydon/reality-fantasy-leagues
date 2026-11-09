import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { catchingUpMark } from "@/lib/server/late-join";
import { lateMark } from "@/lib/server/own-pace-seats";
import { forPlayerChange } from "@/lib/server/change-log";

// Pick'em only: clears the given player's pick for this episode. Same self-or-commissioner shape
// as DELETE .../bets/:betId/predictions/:predId -- a member can remove only their own pick,
// commissioner/super-admin can remove anyone's. `?second` clears only a pool's second pick (step A10 part 2); C5, `?castawayId=`
// only that one of several picks.
export const DELETE = apiRoute(
  async (req, { params }: { params: Promise<{ leagueId: string; epId: string; playerId: string }> }) => {
    const { leagueId, epId, playerId } = await params;
    const { user, membership } = await requireLeagueRole(req, leagueId, "member");
    if (membership.role !== "commissioner" && playerId !== membership.playerId) {
      throw new HttpError(403, "You can only remove your own pick");
    }

    const q = new URL(req.url).searchParams;
    const one = q.get("castawayId");
    const opts = q.has("second") ? { second: true } : one ? { castawayId: one } : undefined;
    const state = await withLeagueLock(leagueId, async (s) => {
      const caught = await catchingUpMark(leagueId, s, playerId);
      // Someone playing at their own pace (docs/PLAN-own-pace-games.md): the aired episode, until they've watched it.
      const late = caught === null ? await lateMark(leagueId, s, playerId, epId) : null;
      const mark = caught ?? late;
      if (mark !== null) {
        const problem = StateLogic.GhostLogic.applyAs(s, playerId, mark, epId, (v) => StateLogic.removePickEmPick(v, epId, playerId, opts), { late: late !== null });
        if (problem) throw new HttpError(400, problem);
        return;
      }
      StateLogic.removePickEmPick(s, epId, playerId, opts);
    }, forPlayerChange(user.id, membership.playerId, playerId, "pick", (name) => (q.has("second") ? `Cleared ${name}'s second pick` : `Cleared ${name}'s pick`), { kind: "pick", episodeId: epId }));
    return NextResponse.json(state);
  }
);
