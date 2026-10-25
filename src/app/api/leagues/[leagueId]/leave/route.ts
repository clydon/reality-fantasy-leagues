import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { leftLeague } from "@/lib/server/couches";
import { leaveProblem } from "@/lib/server/backstage-members";

// Port of SurvivorDraft's server/routes/leagues.js POST /:leagueId/leave -- before the draft
// starts, your roster slot is fully removed (it never held any points); once the draft has
// started, your player stays in the league (roster/points intact) but gets disabled and
// unlinked from your account, since removing it outright would silently erase whatever they
// already drafted.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const user = await requireAuth(req);

  const membership = await pool.query("SELECT id, player_id FROM league_memberships WHERE league_id=$1 AND user_id=$2", [
    leagueId,
    user.id,
  ]);
  if (!membership.rows.length) throw new HttpError(404, "You're not in this league");
  const playerId = membership.rows[0].player_id;
  // A league always keeps a Commissioner (roles.ts): the last one hands it to someone before leaving.
  const problem = await leaveProblem(leagueId, user.id);
  if (problem) throw new HttpError(409, problem);

  const leagueRes = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!leagueRes.rows.length) throw new HttpError(404, "League not found");
  const state = leagueRes.rows[0].state;

  if (state.draftPicksMade === 0) {
    StateLogic.removePlayer(state, playerId);
  } else {
    StateLogic.disablePlayer(state, playerId, user.id);
  }
  await pool.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), leagueId]);
  await pool.query("DELETE FROM league_memberships WHERE id=$1", [membership.rows[0].id]);
  // Off its couch too, unless another of the couch's leagues still has them (couches.ts).
  await leftLeague(leagueId);

  return NextResponse.json({ ok: true });
});
