import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { joinedLeague } from "@/lib/server/couches";
import { lastCommissionerProblem, LEAGUE_ROLES, type LeagueRole } from "@/lib/server/roles";

// Port of SurvivorDraft's server/routes/admin.js GET/POST /leagues/:leagueId/memberships.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  await requireSuperAdmin(req);
  const { leagueId } = await params;
  const leagueRes = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!leagueRes.rows.length) throw new HttpError(404, "League not found");

  const { rows } = await pool.query(
    `SELECT m.id, m.player_id, m.role, u.id as user_id, u.username
     FROM league_memberships m JOIN "user" u ON u.id = m.user_id
     WHERE m.league_id=$1 ORDER BY u.username`,
    [leagueId]
  );
  return NextResponse.json({ players: leagueRes.rows[0].state.players, memberships: rows });
});

// Upsert: linking an already-linked player (same league_id+user_id) just updates their role --
// this is also how "change a member's role" works, no separate route needed for that.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  await requireSuperAdmin(req);
  const { leagueId } = await params;
  const { userId, playerId, role } = (await req.json().catch(() => ({}))) as {
    userId?: string;
    playerId?: string;
    role?: string;
  };
  if (!userId || !playerId || !LEAGUE_ROLES.includes(role as LeagueRole)) {
    throw new HttpError(400, "userId, playerId, and a valid role are required");
  }
  // A league always keeps a Commissioner (roles.ts).
  const { rows: roles } = await pool.query("SELECT user_id, role FROM league_memberships WHERE league_id=$1", [leagueId]);
  const problem = lastCommissionerProblem(roles.map((r) => ({ userId: r.user_id, role: r.role })), userId, role as LeagueRole);
  if (problem) throw new HttpError(409, problem);

  try {
    const { rows } = await pool.query(
      `INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1,$2,$3,$4)
       ON CONFLICT (league_id, user_id) DO UPDATE SET player_id=$3, role=$4
       RETURNING id, player_id, role, user_id`,
      [leagueId, userId, playerId, role]
    );
    await joinedLeague(leagueId, userId);
    return NextResponse.json({ membership: rows[0] });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new HttpError(409, "That player is already linked to another account in this league");
    }
    throw e;
  }
});
