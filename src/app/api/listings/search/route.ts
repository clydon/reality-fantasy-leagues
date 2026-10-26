import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { listingsFor, ListingsUnavailable, searchListings } from "@/lib/server/listings";

// Add a show's suggestions from the TV listings (docs/PLAN-new-design.md step 10 part 1; listings.ts): TVmaze's show search
// for `?q=`, up to ten shows. Open signed out (first run searches before there's an account) and the same for everyone, so
// the edge keeps each query for an hour; it reads nothing from the database. When TVmaze doesn't answer, `unavailable` and
// no shows (the sheet still has the shows already here), cached for a minute only.
export const GET = apiRoute(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 80) return NextResponse.json({ hits: [] });
  try {
    const hits = await searchListings(q, listingsFor(req));
    return NextResponse.json({ hits }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    if (!(e instanceof ListingsUnavailable)) throw e;
    console.error("[listings] search:", e.message);
    return NextResponse.json({ hits: [], unavailable: true }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
});
