import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { listingsWeek } from "@/lib/server/tv-listings";

// The week on TV for the guide's Also on (docs/PLAN-new-design.md step 11 part 2; tv-listings.ts): every evening's airings
// and streaming drops from yesterday on, from tv_listings (refreshed once a day). The same for everyone, with nobody's data
// in it (the browser leaves out your shows, the couch's and what you've hidden), so the edge keeps it for an hour: at most one
// read from the database an hour, whoever opens the hub. Open signed out too (it's TV listings), never a title.
export const GET = apiRoute(async () => {
  return NextResponse.json(await listingsWeek(), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } });
});
