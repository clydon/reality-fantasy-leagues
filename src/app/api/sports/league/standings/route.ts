import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { leaguePath } from "@/lib/server/sports/find";
import { leagueStandings } from "@/lib/server/sports/league-standings";
import { SportsUnavailable } from "@/lib/server/sports/types";

// A league's standings (docs/PLAN-sports-couch.md B1, the Standings tab): `?league=football/nfl` answers its groups and each team's
// line (league-standings.ts), or `{ standings: null }` for a league the provider has no table for. Nothing about anyone, so it's
// open signed out and the same for everyone: the edge keeps it five minutes (the cache keeps the provider's answer 15).
export const GET = apiRoute(async (req) => {
  const league = leaguePath(new URL(req.url).searchParams.get("league"));
  if (!league) throw new HttpError(400, "Say which league: ?league=");
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  try {
    const standings = await leagueStandings(league, sports ? { providers: sportsProviders({ base: sports }) } : {});
    return NextResponse.json({ standings }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } });
  } catch (e) {
    if (e instanceof SportsUnavailable) throw new HttpError(503, "Sports aren't available right now");
    throw e;
  }
});
