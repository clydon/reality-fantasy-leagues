import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

type RouteParams = { leagueId: string; id: string };

// Reject one episode-research decision. Kept as a resolved row rather than deleted, for the same
// reason as wiki-items/[id]/reject: a rejected decision must not reappear as if it were new the next
// time this episode gets researched -- idx_research_items_identity's upsert leaves any non-pending
// row alone (db/migrations/0015).
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  if (!isUuid(id)) throw new HttpError(404, "Item not found");

  const { rowCount } = await pool.query(
    `UPDATE episode_research_items SET status='rejected', decided_at=now(), decided_by=$3
      WHERE id=$1 AND league_id=$2 AND status='pending'`,
    [id, leagueId, user.id]
  );
  if (!rowCount) throw new HttpError(404, "No pending item with that id");
  return NextResponse.json({ ok: true });
});
