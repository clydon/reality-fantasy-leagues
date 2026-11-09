import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { sportsWeek } from "@/lib/server/sports/week";

// The guide's Sports (docs/PLAN-start-a-game-gpt.md U1's sports slice; week.ts): `?from=2026-11-09` (a day in the East) and
// `&also=basketball/mens-college-basketball` (a couch team's league beyond the pro ones), a week of games a day at a time. Open
// signed out and the same for everyone: the edge keeps it five minutes (a game's state moves; the day scoreboards are cached on
// their own). Scores are in it: the phone hides them for whoever has Sports scores too on.
export const GET = apiRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const also = (q.get("also") ?? "").split(",").map((l) => l.trim().toLowerCase()).filter((l) => /^[a-z0-9-]+\/[a-z0-9.-]+$/.test(l)).slice(0, 6);
  const sports = sportsFor(req);
  if (sports === null) return NextResponse.json({ days: [], down: [] });
  const week = await sportsWeek({ from: q.get("from"), also, ...(sports ? { providers: sportsProviders({ base: sports }) } : {}) });
  return NextResponse.json(week, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
});
