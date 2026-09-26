import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { pool } from "@/lib/server/db";

// Catalog for the Demo Season picker (db/migrations/0026_demo_seasons_generic.sql). Deliberately
// public -- no requireAuth -- since the whole point is to let a logged-out visitor try a real season
// before they have an account, the same way mock mode itself needs no session. Only the lightweight
// catalog fields are returned here; the full per-season data (cast, episodes) is a separate GET by id
// so picking one season doesn't ship all of them to the browser.
//
// No league_type_id here any more: a season carries no fixed game type of its own -- the picker asks
// which show, then separately which of the 3 league types to try it as (demo-season-builder.ts
// computes ownership/roster-size generically for whichever one is picked).
export const GET = apiRoute(async () => {
  const { rows } = await pool.query(
    `SELECT id, show_id AS "showId", name, episode_count AS "episodeCount"
       FROM demo_seasons
      ORDER BY created_at`
  );
  return NextResponse.json({ seasons: rows });
});
