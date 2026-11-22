import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { sportsWeek } from "@/lib/server/sports/week";

// The guide's Sports (docs/PLAN-start-a-game-gpt.md U1's sports slice; week.ts): `?from=2026-11-09` (a day in the East) and
// `&also=basketball/mens-college-basketball` (a couch team's league beyond the pro ones), a week of games a day at a time (`&only=1&to=` a league page's, of that league alone). Open
// signed out and the same for everyone: the edge keeps it five minutes (a game's state moves; the day scoreboards are cached on
// their own). Scores are in it: the phone hides them for whoever has Sports scores too on.
export const GET = apiRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const also = (q.get("also") ?? "").split(",").map((l) => l.trim().toLowerCase()).filter((l) => /^[a-z0-9-]+\/[a-z0-9.-]+$/.test(l)).slice(0, 6);
  const sports = sportsFor(req);
  if (sports === null) return NextResponse.json({ days: [], down: [] });
  // `only=1`: just `also`'s leagues, and `to` a week longer than seven days (a league's page, docs/PLAN-sports-couch.md B1).
  const only = q.get("only") === "1" && also.length > 0;
  const week = await sportsWeek({ from: q.get("from"), to: only ? q.get("to") : null, also, only, ...(sports ? { providers: sportsProviders({ base: sports }) } : {}) });
  // A week with a game on is kept a minute at the edge (its day scoreboard moves every three); one without, five.
  const on = week.days.some((d) => d.games.some((g) => g.state === "in"));
  return NextResponse.json(week, { headers: { "Cache-Control": on ? "public, s-maxage=60, stale-while-revalidate=120" : "public, s-maxage=300, stale-while-revalidate=900" } });
});
