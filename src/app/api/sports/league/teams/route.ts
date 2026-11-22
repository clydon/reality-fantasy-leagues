import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { leaguePath } from "@/lib/server/sports/find";
import { leagueTeams, MAX_TABLE_TEAMS } from "@/lib/server/sports/league-teams";
import { SportsUnavailable } from "@/lib/server/sports/types";

// The couch's table in a league (docs/PLAN-sports-couch.md B1, a league's This week): `?league=football/nfl&teams=21,6,19`
// answers each team's record, last five and meetings with the others (league-teams.ts). From the schedules a team's sheet reads,
// and nothing about anyone, so it's open signed out and the same for everyone: the edge keeps it ten minutes, as a team's schedule.
export const GET = apiRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const league = leaguePath(q.get("league"));
  const teams = (q.get("teams") ?? "").split(",").filter((t) => /^[A-Za-z0-9-]{1,20}$/.test(t));
  if (!league || !teams.length) throw new HttpError(400, "Say which league and teams: ?league=&teams=");
  if (teams.length > MAX_TABLE_TEAMS) throw new HttpError(400, `At most ${MAX_TABLE_TEAMS} teams`);
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  try {
    const forms = await leagueTeams(league, teams, sports ? { providers: sportsProviders({ base: sports }) } : {});
    return NextResponse.json({ teams: forms }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    if (e instanceof SportsUnavailable) throw new HttpError(503, "Sports aren't available right now");
    throw e;
  }
});
