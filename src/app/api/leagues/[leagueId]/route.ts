import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { logChange } from "@/lib/server/change-log";

// Port of SurvivorDraft's server/routes/roster.js PATCH / (league rename) -- commissioner-only,
// like every roster.js route.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name) throw new HttpError(400, "name required");

  await pool.query("UPDATE leagues SET name=$1, updated_at=now() WHERE id=$2", [name, leagueId]);
  await logChange(pool, leagueId, { userId: user.id, kind: "league", tier: 1, text: `Renamed the game ${name}` });
  const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new HttpError(404, "League not found");
  return NextResponse.json(rows[0].state);
});
