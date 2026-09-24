import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Pending wiki-connector DECISIONS for this league, one per elimination/event/exile (see
// db/migrations/0009_wiki_extractions_and_items.sql) -- the per-episode "Reveal Outcome" panel
// (Episode Card) fetches all of them once and groups by episode_number itself, same shape as
// wiki-proposals' GET. Commissioner-only: accepting/rejecting is a commissioner action, so there's
// nothing here for a member to do.
//
// Resolved items are deliberately not returned here either -- they're kept in the table as history
// (and as what stops the nightly sync from resurrecting a rejected decision), but the review UI only
// ever needs what's still awaiting one.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  const { rows } = await pool.query(
    `SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, confidence, created_at
       FROM wiki_proposal_items
      WHERE league_id=$1 AND status='pending'
      ORDER BY episode_number ASC, created_at ASC`,
    [leagueId]
  );
  return NextResponse.json({ items: rows });
});
