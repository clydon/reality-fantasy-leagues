import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { find, libraryCounts, requireDesk } from "@/lib/server/desk";
import { findPeople, peopleCounts } from "@/lib/server/desk-people";
import { findReports, reportCounts } from "@/lib/server/desk-reports";

// The desk's Find (step 6b part 2; docs/PLAN-desk-parity.md step 1): one search over shows, seasons, castaways, couches,
// rulebooks and facts, with people and reports apart (a few, and how many match, for "All N people"). An empty search is
// Browse: each kind's list with what's worth knowing, and what's airing.
export const GET = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) {
    const [found, people, library, reports] = await Promise.all([find(""), peopleCounts(), libraryCounts(), reportCounts()]);
    return NextResponse.json({ found, browse: { people, library, reports } });
  }
  const [found, people, reports] = await Promise.all([find(q), findPeople(user, q), findReports(q)]);
  return NextResponse.json({ found, people, reports });
});
