import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { railFor, startSport } from "@/lib/server/sports/start";

// Start a game on a team (docs/PLAN-start-a-game-gpt.md U1's sports slice; src/lib/server/sports/start.ts). GET `?league=&count=&slate=1`:
// the sport's standard games for that many of its games, each with its words and whether it fits (the same for everyone: cached
// a day at the edge). POST `?couch=` { league, team, games | whole, against?, game, tell?, name? } adds the team's games and starts
// the game on them, or { seasonId, game, from?, to? } on a sport's season that's here; Undo is the season's own start route's.
export const GET = apiRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const rail = railFor((q.get("league") ?? "").toLowerCase(), Number(q.get("count") ?? "1"), q.get("slate") === "1");
  return NextResponse.json({ games: rail }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  return NextResponse.json(await startSport(user, new URL(req.url).searchParams.get("couch"), body, sports ? { providers: sportsProviders({ base: sports }) } : {}));
});
