import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/leagueState.js GET / -- what AuthGate's loadFirstLeague
// and the league switcher both fetch on entering a league.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");

  const leagueRes = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  if (!leagueRes.rows.length) throw new HttpError(404, "League not found");
  const league = leagueRes.rows[0];

  const accountsRes = await pool.query(
    `SELECT m.player_id, m.role, u.username FROM league_memberships m
     JOIN "user" u ON u.id = m.user_id WHERE m.league_id=$1`,
    [leagueId]
  );

  return NextResponse.json({
    league: { id: league.id, name: league.name },
    membership,
    state: league.state,
    playerAccounts: accountsRes.rows,
  });
});
