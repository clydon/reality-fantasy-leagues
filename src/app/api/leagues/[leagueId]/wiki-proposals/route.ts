import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Pending wiki-connector proposals for this league. Commissioner-only: these exist purely to be
// confirmed or rejected, and confirming is a commissioner action, so there's nothing here for a
// member to do.
//
// Resolved proposals are deliberately not returned -- they're kept in the table as history, but the
// review UI only ever needs what's still awaiting a decision.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const { rows } = await pool.query(
    `SELECT id, kind, status, payload, provenance, created_at
       FROM wiki_proposals
      WHERE league_id=$1 AND status='pending'
      ORDER BY created_at DESC`,
    [leagueId]
  );
  return NextResponse.json({ proposals: rows });
});
