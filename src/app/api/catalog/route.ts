import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { catalog } from "@/lib/server/way-in";

// The shows first run picks from (docs/PLAN-new-design.md step 9 part 2; way-in.ts catalog): every curated season, on
// now or coming up first. Open signed out (first run starts before an account) and the same for everyone, so the edge
// keeps it for five minutes: show and season names, art and how far each has aired, nothing about any episode.
export const GET = apiRoute(async () => {
  return NextResponse.json({ seasons: await catalog() }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
});
