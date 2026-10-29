import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { find, libraryCounts, requireDesk } from "@/lib/server/desk";
import { browseCouches, findCouches } from "@/lib/server/desk-couches";
import { browseGames, findGames } from "@/lib/server/desk-games";
import { findPeople, peopleCounts } from "@/lib/server/desk-people";
import { findReports, reportCounts } from "@/lib/server/desk-reports";

// The desk's Find (step 6b part 2; docs/PLAN-desk-parity.md step 1): one search over shows, seasons, castaways, rulebooks and
// facts, with people, couches (part 6d), games (part 6a: a join code too) and reports apart (a few, and how many match, for
// "All N people"). An empty search is Browse: each kind's list with what's worth knowing, and what's airing.
export const GET = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) {
    const [found, people, library, reports, games, couches] = await Promise.all([find(""), peopleCounts(), libraryCounts(), reportCounts(), browseGames(), browseCouches()]);
    return NextResponse.json({ found, browse: { people, library, reports, games, couches } });
  }
  const [found, people, reports, games, couches] = await Promise.all([find(q), findPeople(user, q), findReports(q), findGames(q), findCouches(q)]);
  return NextResponse.json({ found, people, reports, games, couches });
});
