import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { myGames } from "@/lib/server/sports/mine";

// The games you play, by their provider's ids, with your pick on each (src/lib/server/sports/mine.ts): the hub's scores strip puts
// them among your teams' games (docs/PLAN-sports-couch.md A1). Yours alone: never kept at the edge.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ games: await myGames(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
});
