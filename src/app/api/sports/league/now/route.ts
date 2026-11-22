import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { leaguePath } from "@/lib/server/sports/find";
import { leagueNow } from "@/lib/server/sports/league-now";
import { SportsUnavailable } from "@/lib/server/sports/types";

// Where a league's season is today (docs/PLAN-sports-couch.md A2: the league card in Your shows): `?league=football/nfl` answers
// its week ("Week 12"), its stage, or the off-season and when it's back (league-now.ts). Only the league's calendar, cached a day
// (slate.ts), and nothing about a result, so it's open signed out and the same for everyone: the edge keeps it ten minutes.
export const GET = apiRoute(async (req) => {
  const league = leaguePath(new URL(req.url).searchParams.get("league"));
  if (!league) throw new HttpError(400, "Say which league: ?league=");
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  let now;
  try {
    now = await leagueNow(league, sports ? { providers: sportsProviders({ base: sports }) } : {});
  } catch (e) {
    if (e instanceof SportsUnavailable) throw new HttpError(503, "Sports aren't available right now");
    throw e;
  }
  if (!now) throw new HttpError(404, "No such league");
  return NextResponse.json(now, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
});
