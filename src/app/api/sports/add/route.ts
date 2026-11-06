import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { addGames, type AddAsk } from "@/lib/server/sports/find";

// Add a team's games (docs/PLAN-start-a-game-gpt.md track L, L7; find.ts addGames): body { league, team, games: [ids] } (one
// game, a series: 1 to 30 from the team's schedule), { league, team, whole: "season" } (its regular season) or { league, team,
// whole: "meetings", against } (their meetings this season). Made (or found: everyone who adds the same games shares one season)
// as a season of the league's show, and followed. Answers { seasonId, made, name, games }. Ten new ones a day. No screen calls
// it yet (U0, U1).
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as AddAsk;
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  return NextResponse.json(await addGames(user.id, body, sports ? { providers: sportsProviders({ base: sports }) } : {}));
});
