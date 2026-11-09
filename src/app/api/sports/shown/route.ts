import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError, pool } from "@/lib/server/db";

// Show the score (docs/PLAN-start-a-game-gpt.md, "Sports spoilers: Hide scores"; src/new/sports/scores.tsx): { league, event }.
// With Sports scores too on, a sport's season goes by your mark (guard.ts), so tapping a game's Show the score moves the mark of
// every season you follow that has that game, up to its episode: its results, standings and pushes come in. Never back.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { league?: unknown; event?: unknown };
  if (typeof body.league !== "string" || typeof body.event !== "string" || body.event.length > 64) throw new HttpError(400, "Say which game: { league, event }");
  const { rowCount } = await pool.query(
    `UPDATE show_follows f SET seen_through = e.episode, updated_at = now()
       FROM (SELECT season_id, max(episode) AS episode FROM season_events WHERE league = $2 AND event_id = $3 GROUP BY season_id) e
      WHERE f.user_id = $1 AND f.season_id = e.season_id AND f.seen_through < e.episode`,
    [user.id, body.league.toLowerCase(), body.event]
  );
  return NextResponse.json({ moved: rowCount ?? 0 });
});
