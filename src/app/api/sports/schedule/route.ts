import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { teamSchedule } from "@/lib/server/sports/find";

// A team's season (docs/PLAN-start-a-game-gpt.md track L, L7; find.ts teamSchedule): `?league=football/nfl&team=21`, with
// `&against=6` for their meetings with one opponent. Its games past and coming, its series, its next game, and what adding each
// makes (each game, each series still to finish, the regular season or their meetings) with the season already made for it.
// Open signed out and the same for everyone: the edge keeps it ten minutes (a game's score moves; the provider's answers are
// cached on their own). No screen reads it yet (U0, U1).
export const GET = apiRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  // ESPN's league paths are lower case.
  const league = (q.get("league") ?? "").toLowerCase();
  const team = q.get("team") ?? "";
  const against = q.get("against");
  const ok = (v: string) => v.length > 0 && v.length <= 80;
  if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/i.test(league) || !ok(team) || (against !== null && !ok(against))) throw new HttpError(400, "Say which team: ?league=&team=");
  const sports = sportsFor(req);
  const schedule = sports === null ? null : await teamSchedule(league, team, { against, ...(sports ? { providers: sportsProviders({ base: sports }) } : {}) });
  if (!schedule) throw new HttpError(404, "No such team");
  return NextResponse.json(schedule, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
});
