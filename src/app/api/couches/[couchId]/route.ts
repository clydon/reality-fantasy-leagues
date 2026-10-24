import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { couchMembers, requireCouch } from "@/lib/server/couches";
import { games, seasonHeaders } from "@/lib/server/show-space";

// One couch (docs/PLAN-new-design.md step 0b): its name, its people, and its games by season. For someone on
// it (or a site admin, as "viewer"); anyone else gets a 404, as if it didn't exist.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const user = await requireAuth(req);
  const yourRole = await requireCouch(user, couchId);
  const { rows } = await pool.query("SELECT id, name, created_at FROM couches WHERE id = $1", [couchId]);
  const [members, couchGames] = await Promise.all([couchMembers([couchId]), games(user.id, { couchIds: [couchId] })]);
  const headers = await seasonHeaders(couchGames.map((g) => g.seasonId).filter((id): id is string => !!id));
  const seasons = [...headers.values()].map((h) => ({ ...h, games: couchGames.filter((g) => g.seasonId === h.seasonId) }));
  return NextResponse.json({
    id: rows[0].id,
    name: rows[0].name,
    createdAt: new Date(rows[0].created_at).toISOString(),
    yourRole,
    members: members.get(couchId) ?? [],
    seasons,
    unscheduled: couchGames.filter((g) => !g.seasonId),
  });
});
