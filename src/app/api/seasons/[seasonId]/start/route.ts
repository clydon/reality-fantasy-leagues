import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { startGame, startOptions } from "@/lib/server/start-game";

// Start a game that fits (docs/PLAN-new-design.md step 10 part 2b; start-game.ts), on a couch (`?couch=`).
//   GET ?again=<leagueId>   what can start here: the season games and whether each fits, the line for each, why the rest
//                           don't, who on the couch watches it, where it starts, how long it can run (spans, ends: step 6 of
//                           docs/PLAN-sports-data.md), and (Run it back) the game it plays again
//   POST { game, tell, again, to }  start it: `game` a key that fits (survivalPool, weeklyLineup, outlast), `tell` the couch
//                           (one push; default on), `again` a finished game of yours to run back, `to` the last episode it
//                           plays (none: to the season's end). -> { leagueId, name, ... }
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await startOptions(user, seasonId, q.get("couch"), q.get("again")));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { game?: unknown; tell?: unknown; again?: unknown; to?: unknown };
  return NextResponse.json(await startGame(user, seasonId, new URL(req.url).searchParams.get("couch"), body));
});
