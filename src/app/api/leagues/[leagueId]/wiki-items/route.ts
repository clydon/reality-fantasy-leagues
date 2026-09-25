import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";

// Pending wiki-connector DECISIONS for this league, one per elimination/event/exile (see
// db/migrations/0009_wiki_extractions_and_items.sql) -- the per-episode "Reveal Outcome" panel
// (Episode Card) fetches all of them once and groups by episode_number itself, same shape as
// wiki-proposals' GET. Commissioner-only: accepting/rejecting is a commissioner action, so there's
// nothing here for a member to do.
//
// Resolved items are deliberately not returned here either -- they're kept in the table as history
// (and as what stops the nightly sync from resurrecting a rejected decision), but the review UI only
// ever needs what's still awaiting one.
// Decided rows are returned too (with their status): the episode card keeps them visible, tinted
// green/red, with their buttons still live so a decision can be changed. Callers that only care
// about what's still awaiting review filter on status === "pending".
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  // Catch-up mode (StateLogic.RevealLogic): a league that started mid-season may only see episodes
  // it has revealed. The connector's fan-out already refuses to WRITE past that gate, so this is
  // belt and braces for one case it can't cover -- a league that synced first and switched into
  // catch-up mode afterwards, whose table already holds the whole season. Those rows stay pending
  // and simply stop being served until their episode is revealed.
  const { rows: leagueRows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  const gate = leagueRows.length ? StateLogic.RevealLogic.revealedThrough(leagueRows[0].state) : null;

  const { rows } = await pool.query(
    `SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, confidence, status, applied, created_at
       FROM wiki_proposal_items
      WHERE league_id=$1
        AND ($2::int IS NULL OR episode_number <= $2)
      ORDER BY episode_number ASC, created_at ASC`,
    [leagueId, gate]
  );
  return NextResponse.json({ items: rows });
});
