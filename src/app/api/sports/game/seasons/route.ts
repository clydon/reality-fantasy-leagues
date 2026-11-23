import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { pool } from "@/lib/server/db";

// The seasons a real game is in, and its episode in each (docs/PLAN-sports-couch.md B4: a game's sheet says which of the couch's
// games already cover this game, so nobody starts a second one). From `season_events`; nothing of anyone's in it, so the same for
// everyone and kept a minute at the edge. GET `?league=&event=`.
export const GET = apiRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const league = (q.get("league") ?? "").toLowerCase();
  const event = q.get("event") ?? "";
  if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(league) || !/^[\w.-]{1,40}$/.test(event)) return NextResponse.json({ error: "Say which league and game" }, { status: 400 });
  const { rows } = await pool.query("SELECT season_id, episode FROM season_events WHERE league = $1 AND event_id = $2 ORDER BY season_id", [league, event]);
  return NextResponse.json(
    { seasons: rows.map((r) => ({ seasonId: r.season_id as string, episode: r.episode as number })) },
    { headers: { "Cache-Control": "public, s-maxage=60" } }
  );
});
