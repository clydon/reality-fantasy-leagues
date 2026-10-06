import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// The show/season catalog as a COMMISSIONER sees it, for the Show and Season pickers in League
// Settings. Deliberately not under /api/admin: managing the catalog is a super-admin job, but
// choosing from it is an ordinary commissioner one, so this is readable by any signed-in user and
// returns only what's usable (archived shows excluded).
//
// Seasons come nested rather than as a second request, because every consumer needs the pairing:
// the Season picker's options depend on which Show is selected.
export const GET = apiRoute(async (req) => {
  await requireAuth(req);

  const { rows } = await pool.query(
    `SELECT s.slug, s.name, s.castaway_term, s.tribe_term, s.art_url,
            COALESCE(
              json_agg(
                json_build_object(
                  'seasonNumber', ss.season_number,
                  'name', ss.name,
                  'status', ss.status,
                  'castSize', ss.cast_size,
                  'premiereDate', ss.premiere_date,
                  'finaleDate', ss.finale_date
                ) ORDER BY ss.season_number DESC
              ) FILTER (WHERE ss.id IS NOT NULL),
              '[]'
            ) AS seasons
       FROM shows s
       LEFT JOIN show_seasons ss ON ss.show_id = s.id
      WHERE s.archived = false
      GROUP BY s.id
      ORDER BY s.name`
  );
  return NextResponse.json({ shows: rows });
});
