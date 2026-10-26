import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// The show/season catalog as a COMMISSIONER sees it, for the Show and Season pickers in League
// Settings. Deliberately not under /api/admin: managing the catalog is a super-admin job, but
// choosing from it is an ordinary commissioner one, so this is readable by any signed-in user and
// returns only what's usable (archived shows excluded, and a show someone added to follow that isn't a game yet: step 10's
// shows.set_up_at, so nobody starts a classic league on one before its rulebook and cast are set up).
//
// Seasons come nested rather than as a second request, because every consumer needs the pairing:
// the Season picker's options depend on which Show is selected.
//
// `resultsBy` says whose job each season's results are: an admin's, pushed into every league, or each
// league's commissioner's (so the Episodes list can tell a commissioner when one needs results applied).
//
// `curated` (no creator: added by an admin) and `mine` let the create-league flow offer a non-admin
// only the curated shows plus their own researched ones, so test shows stay out of everyone else's
// way. The list itself isn't filtered: a member of a league on someone else's researched show still
// needs its terms (useShowTerms reads this same catalog).
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);

  const { rows } = await pool.query(
    `SELECT s.slug, s.name, s.castaway_term, s.tribe_term, s.art_url, s.art_style,
            s.created_by IS NULL AS curated, COALESCE(s.created_by = $1, false) AS mine,
            COALESCE(
              json_agg(
                json_build_object(
                  'seasonNumber', ss.season_number,
                  'name', ss.name,
                  'status', ss.status,
                  'castSize', ss.cast_size,
                  'premiereDate', ss.premiere_date,
                  'finaleDate', ss.finale_date,
                  'resultsBy', ss.results_by
                ) ORDER BY ss.season_number DESC
              ) FILTER (WHERE ss.id IS NOT NULL),
              '[]'
            ) AS seasons
       FROM shows s
       LEFT JOIN show_seasons ss ON ss.show_id = s.id
      WHERE s.archived = false AND s.set_up_at IS NOT NULL
      GROUP BY s.id
      ORDER BY s.name`,
    [user.id]
  );
  return NextResponse.json({ shows: rows });
});
