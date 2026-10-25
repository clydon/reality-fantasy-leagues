import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { syncLeagueDecisions } from "@/lib/server/season-decisions";
import { syncLeagueChanges } from "@db/season-rule-changes.js";
import { plainChange } from "@/lib/server/change-log";

// A commissioner's say over the season's rule changes (docs/PLAN-season-rule-changes.md): adopt one
// (with this league's points for its new events), decline it, or remove one adopted earlier. The
// rules themselves are StateLogic.RuleChangeLogic; this adds what needs the database.
//
//   adopt    -- the season's results are applied again: any that used the change's new events were
//               skipped while this league didn't have them, and land now (syncLeagueDecisions only
//               ever tries what isn't in the league's ledger yet).
//   remove   -- the results of its events go, and so do their ledger entries, so adopting it again
//               later brings them back rather than finding them "already applied".
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { changeId?: unknown; action?: unknown; points?: unknown };
  const changeId = typeof body.changeId === "string" ? body.changeId : "";
  const action = body.action;
  if (!changeId || !["adopt", "decline", "remove"].includes(String(action))) throw new HttpError(400, "changeId and action (adopt, decline or remove) required");
  const points: Record<string, number> = {};
  if (body.points && typeof body.points === "object" && !Array.isArray(body.points)) {
    for (const [k, v] of Object.entries(body.points as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isFinite(v)) throw new HttpError(400, `points for ${k} must be a number`);
      points[k] = v;
    }
  }

  const state = await withLeagueLock(leagueId, async (s, client) => {
    // What's offered, fresh: never adopt a version the admin has since edited or withdrawn.
    await syncLeagueChanges(client, s.settings);
    if (action === "adopt") {
      if (!StateLogic.RuleChangeLogic.adopt(s, changeId, points)) throw new HttpError(404, "That change isn't offered to this league (it may have been withdrawn)");
      await syncLeagueDecisions(client, leagueId, s);
    } else if (action === "decline") {
      if (!StateLogic.RuleChangeLogic.decline(s, changeId)) throw new HttpError(404, "That change isn't offered to this league");
    } else {
      const takenBack = StateLogic.RuleChangeLogic.remove(s, changeId);
      if (!takenBack) throw new HttpError(404, "This league hasn't adopted that change");
      if (takenBack.length) {
        await client.query("DELETE FROM league_applied_decisions WHERE league_id=$1 AND detail->>'eventType' = ANY($2)", [leagueId, takenBack]);
      }
    }
  }, plainChange(user.id, "rules", "Changed the season's rules", 2));
  return NextResponse.json(state);
});
