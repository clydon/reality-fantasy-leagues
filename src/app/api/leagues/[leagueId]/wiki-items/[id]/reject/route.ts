import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

type RouteParams = { leagueId: string; id: string };

// Reject one wiki-connector decision. Kept as a resolved row rather than deleted, so a rejected
// decision doesn't simply reappear as if it were new on the next scheduled run -- see 0009's
// identity-index comment for why the fan-out's upsert leaves any non-pending row alone.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  if (!isUuid(id)) throw new HttpError(404, "Item not found");

  const { rowCount } = await pool.query(
    `UPDATE wiki_proposal_items SET status='rejected', decided_at=now(), decided_by=$3
      WHERE id=$1 AND league_id=$2 AND status='pending'`,
    [id, leagueId, user.id]
  );
  if (!rowCount) throw new HttpError(404, "No pending item with that id");
  return NextResponse.json({ ok: true });
});
