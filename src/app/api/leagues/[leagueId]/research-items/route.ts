import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import StateLogic from "@/lib/game/state-logic.js";

// Pending episode-research decisions for this league (db/migrations/0015_episode_research_items.sql)
// -- the research connector's counterpart to wiki-items/route.ts, same shape on purpose: the episode
// card fetches all of them once and groups by episode_number itself, and resolved items are left out
// for the same reason -- they're kept as permanent history, not as something to keep re-displaying.
//
// The one real difference from a wiki item is `sources`: a search has no revision id to point at, so
// each item's URLs are what a reviewer checks against instead. Confidence is three-valued here
// (db/episode-research.js's CastawayChecklist), not two -- carried through unchanged rather than
// collapsed, because collapsing 'unknown' into 'low' is exactly the failure the schema exists to
// avoid.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");

  // Same catch-up belt-and-braces as wiki-items/route.ts: stageResearchItemsForLeague already
  // refuses to WRITE past the reveal gate, but a league that synced before switching into catch-up
  // mode could still hold rows past it -- so this filters read-side too.
  const { rows: leagueRows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  const gate = leagueRows.length ? StateLogic.RevealLogic.revealedThrough(leagueRows[0].state) : null;

  const { rows } = await pool.query(
    `SELECT id, episode_number, kind, castaway_name, event_type, confidence, sources, created_at
       FROM episode_research_items
      WHERE league_id=$1 AND status='pending'
        AND ($2::int IS NULL OR episode_number <= $2)
      ORDER BY episode_number ASC, created_at ASC`,
    [leagueId, gate]
  );
  return NextResponse.json({ items: rows });
});
