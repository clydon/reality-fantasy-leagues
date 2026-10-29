import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { find, libraryCounts, requireDesk } from "@/lib/server/desk";
import { findPeople, peopleCounts } from "@/lib/server/desk-people";

// The desk's Find (step 6b part 2; docs/PLAN-desk-parity.md step 1): one search over shows, seasons, castaways, couches,
// rulebooks and facts, with people apart (a few, and how many match, for "All N people"). An empty search is Browse:
// each kind's list with what's worth knowing, and what's airing.
export const GET = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) {
    const [found, people, library] = await Promise.all([find(""), peopleCounts(), libraryCounts()]);
    return NextResponse.json({ found, browse: { people, library } });
  }
  const [found, people] = await Promise.all([find(q), findPeople(user, q)]);
  return NextResponse.json({ found, people });
});
