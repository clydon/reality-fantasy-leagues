import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { addGames, addSlate, type AddAsk, type SlateAsk } from "@/lib/server/sports/find";

// Add a team's games (docs/PLAN-start-a-game-gpt.md track L, L7; find.ts addGames): body { league, team, games: [ids] } (one
// game, a series: 1 to 30 from the team's schedule), { league, team, whole: "season" } (its regular season) or { league, team,
// whole: "meetings", against } (their meetings this season). Made (or found: everyone who adds the same games shares one season)
// as a season of the league's show, and followed. Answers { seasonId, made, name, games }.
// Or a league's slate (L8 part 2; find.ts addSlate): body { league, slate: { stage?, cadence? } } (GET /api/sports/league says
// what it can be), made or found and followed the same way; answers { seasonId, made, name, league, stage, cadence, episodes,
// games } (games: linked so far). Ten new ones a day, matchups and slates together. No screen calls it yet (U0, U1).
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  // Checked by addSlate and addGames themselves.
  const body: unknown = await req.json().catch(() => ({}));
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  const opts = sports ? { providers: sportsProviders({ base: sports }) } : {};
  if (body && typeof body === "object" && "slate" in body) return NextResponse.json(await addSlate(user.id, body as SlateAsk, opts));
  return NextResponse.json(await addGames(user.id, body as AddAsk, opts));
});
