import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { undoAppliedItem } from "@/lib/server/connector-items";

type RouteParams = { leagueId: string; id: string };

// Reject one episode-research decision. Kept as a resolved row rather than deleted, for the same
// reason as wiki-items/[id]/reject: a rejected decision must not reappear as if it were new the next
// time this episode gets researched -- idx_research_items_identity's upsert leaves any non-pending
// row alone (db/migrations/0015).
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  if (!isUuid(id)) throw new HttpError(404, "Item not found");

  // Rejecting something already ACCEPTED is allowed (a misclick, a change of mind): undo what the
  // accept applied, then mark it rejected -- one transaction, under the league lock. Rejecting a row
  // that's already rejected is a no-op.
  let found = false;
  const state = await withLeagueLock(leagueId, async (s, client) => {
    const { rows } = await client.query(
      `SELECT * FROM episode_research_items WHERE id=$1 AND league_id=$2 FOR UPDATE`,
      [id, leagueId]
    );
    if (!rows.length) return;
    found = true;
    const item = rows[0];
    if (item.status === "rejected") return;
    if (item.status === "accepted") undoAppliedItem(s, item);
    await client.query(
      `UPDATE episode_research_items SET status='rejected', decided_at=now(), decided_by=$2, applied=NULL WHERE id=$1`,
      [id, user.id]
    );
  });
  if (!found) throw new HttpError(404, "Item not found");
  return NextResponse.json({ ok: true, state });
});
