import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { leagueCountForSeason } from "@/lib/server/season-decisions";
import { stageCachedSeasonEpisodes } from "@db/wiki-sync.js";
import { stageCachedSeasonResearch } from "@db/episode-research.js";
import { formatDataFor } from "@db/show-formats.js";
import { approvedChanges } from "@db/season-rule-changes.js";

// Every episode decision for one season (db/migrations/0019), decided or not -- the admin's review
// list and the long-term record of what was decided, by whom and when. Super-admin only.
//
// A season read before decisions moved here has results cached but no decisions yet; the first look
// stages them from those caches (no wiki read, no search, nothing charged) so the review isn't empty.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const { rows: season } = await pool.query(
    "SELECT ss.id, s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1",
    [id]
  );
  if (!season.length) throw new HttpError(404, "Season not found");

  const { rows: any } = await pool.query("SELECT 1 FROM season_decisions WHERE season_id=$1 LIMIT 1", [id]);
  if (!any.length) {
    try {
      await stageCachedSeasonEpisodes(pool, id);
      await stageCachedSeasonResearch(pool, id);
    } catch {
      // No cast yet, or a cache that no longer validates: an empty list is the honest answer.
    }
  }

  const { rows: decisions } = await pool.query(
    `SELECT d.id, d.episode_number, d.post_merge, d.kind, d.castaway_name, d.method, d.event_type, d.jury_votes, d.confidence,
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
  // The show's format, so the review offers its exit methods and events when correcting a result.
  return NextResponse.json({
    decisions,
    cast,
    leagueCount: await leagueCountForSeason(id),
    format: season[0].format,
    formatData: await formatDataFor(pool, season[0].format),
    // The season's approved rule changes, so a change's new events show by their labels.
    ruleChanges: await approvedChanges(pool, id),
  });
});
