import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { pool, HttpError } from "@/lib/server/db";

type RouteParams = { id: string };

// One season's full researched data (db/migrations/0026_demo_seasons_generic.sql), for
// demo-season-builder.ts to turn into a LeagueState (for whichever league type the picker's second
// step chose). Public, same reasoning as the list route.
export const GET = apiRoute(async (_req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const { rows } = await pool.query(`SELECT data FROM demo_seasons WHERE id=$1`, [id]);
  if (!rows.length) throw new HttpError(404, "No such demo season");
  return NextResponse.json({ season: rows[0].data });
});
