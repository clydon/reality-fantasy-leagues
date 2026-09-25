import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { seasonCastRows, applyApprovedCastToLeagues } from "@/lib/server/season-cast";

// Approve a season's cast: mark it reviewed, then push it into every league already tracking the
// season. A league that picks the season later gets it from the settings route instead -- see
// src/lib/server/season-cast.ts, which owns both paths.
//
// This is the step that used to be each commissioner's ("Apply" on a per-league cast proposal), and
// moving it here is the point of db/migrations/0011: whoever catalogues a season can now finish the
// job, and a commissioner never has to know the cast arrived as a proposal at all.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const { rows } = await pool.query(
    `SELECT ss.season_number, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");

  const cast = await seasonCastRows(id);
  if (!cast.length) throw new HttpError(400, "There's no staged cast to approve — pull the cast for this season first.");

  const { rows: approved } = await pool.query(
    "UPDATE show_seasons SET cast_approved_at=now(), cast_approved_by=$2, updated_at=now() WHERE id=$1 RETURNING cast_approved_at",
    [id, user.id]
  );

  // Applied AFTER the approval is recorded: if a league write fails, the cast is still approved and
  // the same rows reach that league the next time it's touched (a re-approve, or the league picking
  // the season again) rather than the approval being lost along with it.
  const applied = await applyApprovedCastToLeagues(rows[0].slug, rows[0].season_number, cast);

  return NextResponse.json({ approvedAt: approved[0].cast_approved_at, castSize: cast.length, applied });
});
