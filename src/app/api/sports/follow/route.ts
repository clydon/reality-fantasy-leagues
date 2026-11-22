import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { setLeagueFollow, setTeamFollow, yourFollows } from "@/lib/server/sports/team-follows";

// Following a team or a league (docs/PLAN-sports-couch.md A3; team-follows.ts): GET your teams and leagues; POST { league, team,
// follow } follows or stops following a team (its name and mark from its league's list; following one follows its league),
// { league, follow } a league alone, and { league, team, myTeam: true } makes a team you follow your team in its league. Each
// answers what you follow. Adds no game: the couch's teams lead the guide's Sports, and a league you follow has its card in Your shows.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json(await yourFollows(user.id));
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { league?: unknown; team?: unknown; follow?: unknown; myTeam?: unknown };
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  const opts = sports ? { providers: sportsProviders({ base: sports }) } : {};
  return NextResponse.json(body.team === undefined ? await setLeagueFollow(user.id, body, opts) : await setTeamFollow(user.id, body, opts));
});
