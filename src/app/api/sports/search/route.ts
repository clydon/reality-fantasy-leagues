import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { searchTeams } from "@/lib/server/sports/find";

// Finding a game by team (docs/PLAN-start-a-game-gpt.md track L, L7; find.ts searchTeams): the teams `?q=` names across the
// leagues the app's sports read, best first (pro before college), and a matchup when it names two teams of one league in any
// order ("cowboys eagles", "eagles at cowboys"), the first few each with their next game. Open signed out, as the TV listings'
// search is, and the same for everyone, so the edge keeps each query for an hour. No screen reads it yet (U0, U1).
export const GET = apiRoute(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  const sports = sportsFor(req);
  if (q.length < 2 || q.length > 80 || sports === null) return NextResponse.json({ teams: [], matchup: null });
  const found = await searchTeams(q, sports ? { providers: sportsProviders({ base: sports }) } : {});
  return NextResponse.json(found, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
});
