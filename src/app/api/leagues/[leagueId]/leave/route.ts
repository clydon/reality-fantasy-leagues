import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import { leftLeague } from "@/lib/server/couches";
import { freeSeat, leaveProblem } from "@/lib/server/backstage-members";

// Port of SurvivorDraft's server/routes/leagues.js POST /:leagueId/leave -- before the draft
// starts, your roster slot is fully removed (it never held any points); once the draft has
// started, your player stays in the league (roster/points intact) but gets disabled and
// unlinked from your account, since removing it outright would silently erase whatever they
// already drafted. A team they share stays with the others on it, as it was (step A10 part 4b: shared-seats.ts): freeSeat,
// inside the league's lock, so two on one team leaving at once can't leave it with nobody and nothing done.
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

  await withLeagueLock(leagueId, async (s, client) => {
    const { rows } = await client.query("SELECT id FROM league_memberships WHERE id=$1 FOR UPDATE", [membership.rows[0].id]);
    if (!rows.length) return;
    await freeSeat(s, client, leagueId, s.players.find((p) => p.id === playerId), user.id);
    await client.query("DELETE FROM league_memberships WHERE id=$1", [membership.rows[0].id]);
  });
  // Off its couch too, unless another of the couch's leagues still has them (couches.ts).
  await leftLeague(leagueId);

  return NextResponse.json({ ok: true });
});
