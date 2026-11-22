import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { myGames, mySportSeasons } from "@/lib/server/sports/mine";

// The games you play, by their provider's ids, with your pick on each (src/lib/server/sports/mine.ts): the hub's scores strip puts
// them among your teams' games (docs/PLAN-sports-couch.md A1); and each sports season your games and your couches' games are on,
// with its league, for each league's card in Your shows (A2). Yours alone: never kept at the edge.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const [games, seasons] = await Promise.all([myGames(user.id), mySportSeasons(user.id)]);
  return NextResponse.json({ games, seasons }, { headers: { "Cache-Control": "private, no-store" } });
});
