import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { leaguePath } from "@/lib/server/sports/find";
import { leagueSlates } from "@/lib/server/sports/slate";
import { SportsUnavailable } from "@/lib/server/sports/types";

// What a league's slate can be (docs/PLAN-start-a-game-gpt.md track L, L8 part 2; slate.ts leagueSlates): `?league=football/nfl`.
// Its season now, its stages (the regular season, the playoffs) and the ways each is cut (by week, day or round, its usual first),
// each named, with its episodes and the season already made for it; a tour's league says it has no slate. Adding one is POST
// /api/sports/add with { league, slate: { stage?, cadence? } }. Open signed out and the same for everyone: the edge keeps it ten
// minutes (a slate made shows its season; the provider's calendar is cached a day on its own). No screen reads it yet (U0, U1).
export const GET = apiRoute(async (req) => {
  const league = leaguePath(new URL(req.url).searchParams.get("league"));
  if (!league) throw new HttpError(400, "Say which league: ?league=");
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available here");
  let slates;
  try {
    slates = await leagueSlates(league, sports ? { providers: sportsProviders({ base: sports }) } : {});
  } catch (e) {
    if (e instanceof SportsUnavailable) throw new HttpError(503, "Sports aren't available right now");
    throw e;
  }
  if (!slates) throw new HttpError(404, "No such league");
  // An answer missing a count (the provider not answering for a round's fixtures) is kept a minute, not ten.
  const partial = slates.stages.some((s) => s.slates.some((x) => x.episodes === null));
  return NextResponse.json(slates, { headers: { "Cache-Control": partial ? "public, s-maxage=60" : "public, s-maxage=600, stale-while-revalidate=3600" } });
});
