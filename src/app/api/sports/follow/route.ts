import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { setTeamFollow, yourTeams } from "@/lib/server/sports/team-follows";

// Following a team (docs/PLAN-start-a-game-gpt.md U1's sports slice; team-follows.ts): GET your teams; POST { league, team, follow }
// follows or stops following one (its name and mark from its league's list). Adds no game: the couch's teams lead the guide's Sports.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ teams: await yourTeams(user.id) });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { league?: unknown; team?: unknown; follow?: unknown };
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  return NextResponse.json({ teams: await setTeamFollow(user.id, body, sports ? { providers: sportsProviders({ base: sports }) } : {}) });
});
