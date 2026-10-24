import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { leagueCountForSeason, seasonCastRefs } from "@/lib/server/season-decisions";
import { inLeague } from "@/lib/server/episode-research-apply";
import type { LeagueState } from "@/lib/game/types";
import { stageCachedSeasonResearch } from "@db/episode-research.js";
import { formatDataFor } from "@db/show-formats.js";
import { approvedChanges } from "@db/season-rule-changes.js";

// Every episode decision for one season (db/migrations/0019), decided or not -- the admin's review
// list and the long-term record of what was decided, by whom and when. Super-admin only.
//
// A season researched before decisions moved here has results cached but no decisions yet; the first
// look stages them from that cache (no search, nothing charged) so the review isn't empty.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const { rows: season } = await pool.query(
    "SELECT ss.id, ss.results_by, s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1",
    [id]
  );
  if (!season.length) throw new HttpError(404, "Season not found");

  const { rows: any } = await pool.query("SELECT 1 FROM season_decisions WHERE season_id=$1 LIMIT 1", [id]);
  if (!any.length) {
    try {
      await stageCachedSeasonResearch(pool, id);
    } catch {
      // No cast yet, or a cache that no longer validates: an empty list is the honest answer.
    }
  }

  const { rows: decisions } = await pool.query(
    `SELECT d.id, d.episode_number, d.post_merge, d.kind, d.castaway_name, d.method, d.event_type, d.jury_votes, d.units, d.confidence,
            d.from_wiki, d.from_research, d.sources, d.status, d.applied, d.decided_at, d.created_at,
            u.name AS decided_by_name,
            (SELECT count(*)::int FROM league_applied_decisions a WHERE a.decision_id = d.id) AS applied_leagues
       FROM season_decisions d
       LEFT JOIN "user" u ON u.id = d.decided_by
      WHERE d.season_id=$1
      ORDER BY d.episode_number ASC, d.created_at ASC`,
    [id]
  );
  const { rows: cast } = await pool.query(
    `SELECT name, tribe_name AS "tribeName", photo_url AS "photoUrl"
       FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC`,
    [id]
  );
  // Curator mode (docs/PLAN-universal-season-cast.md, piece 5): on a league-decided season nothing here
  // pushes into leagues, so the ledger count means nothing. Instead each result says which leagues
  // already have it -- worked out now from each league's own state (the commissioner panel's inLeague),
  // nothing stored -- so a result no league applied stands out.
  const resultsBy: "admin" | "leagues" = season[0].results_by;
  if (resultsBy === "leagues") {
    const { rows: leagues } = await pool.query<{ name: string; state: LeagueState }>(
      `SELECT l.name, l.state FROM leagues l
         JOIN shows s ON s.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE ss.id = $1 ORDER BY l.name`,
      [id]
    );
    const client = await pool.connect();
    let refs: { id: string; name: string }[] = [];
    try {
      refs = await seasonCastRefs(client, id);
    } finally {
      client.release();
    }
    for (const d of decisions) {
      const row = {
        kind: d.kind,
        castawayName: d.applied?.castawayName || d.castaway_name,
        eventType: d.applied?.eventType || d.event_type,
      };
      d.in_leagues = leagues.filter((l) => inLeague(l.state, d.episode_number, row, refs)).map((l) => l.name);
    }
  }

  // The show's format, so the review offers its exit methods and events when correcting a result.
  return NextResponse.json({
    resultsBy,
    decisions,
    cast,
    leagueCount: await leagueCountForSeason(id),
    format: season[0].format,
    formatData: await formatDataFor(pool, season[0].format),
    // The season's approved rule changes, so a change's new events show by their labels.
    ruleChanges: await approvedChanges(pool, id),
  });
});
