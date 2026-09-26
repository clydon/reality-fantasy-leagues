import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { pool } from "@/lib/server/db";

// Catalog for the Demo Season picker (db/migrations/0025_demo_seasons.sql). Deliberately public --
// no requireAuth -- since the whole point is to let a logged-out visitor try a real season before
// they have an account, the same way mock mode itself needs no session. Only the lightweight catalog
// fields are returned here; the full per-season data (cast, episodes) is a separate GET by id so
// picking one season doesn't ship all of them to the browser.
export const GET = apiRoute(async () => {
  const { rows } = await pool.query(
    `SELECT id, show_id AS "showId", league_type_id AS "leagueTypeId", name, episode_count AS "episodeCount"
       FROM demo_seasons
      ORDER BY created_at`
  );
  return NextResponse.json({ seasons: rows });
});
