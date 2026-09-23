import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/admin.js DELETE /users/:userId -- deletes the account
// outright, but disables (not removes) any player seats it's linked to first, so roster/points
// history in each league stays intact instead of turning into an orphaned real username with no
// owner. Same treatment as removing a player directly (RosterLogic.disablePlayer).
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  const admin = await requireSuperAdmin(req);
  const { userId } = await params;
  if (userId === admin.id) throw new HttpError(400, "You can't delete your own account");

  const memberships = await pool.query("SELECT league_id, player_id FROM league_memberships WHERE user_id=$1", [userId]);
  for (const m of memberships.rows) {
    const leagueRes = await pool.query("SELECT state FROM leagues WHERE id=$1", [m.league_id]);
    if (!leagueRes.rows.length) continue;
    const state = leagueRes.rows[0].state;
    StateLogic.disablePlayer(state, m.player_id, userId);
    await pool.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), m.league_id]);
  }

  await auth.api.removeUser({ body: { userId }, headers: req.headers });
  return NextResponse.json({ ok: true });
});
