import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { gifsFor, searchGifs } from "@/lib/server/gifs";

// GIFs for a watch along (docs/PLAN-new-design.md step 13 part 1; gifs.ts): `?q=` searches GIPHY, none asks what's trending. 404
// when GIFs aren't set up (no GIPHY_API_KEY). The same for everyone with nobody's data in it, so the edge keeps each search an hour:
// GIPHY's beta key allows 100 calls an hour (docs/HOSTING.md).
export const GET = apiRoute(async (req) => {
  await requireAuth(req);
  const src = gifsFor(req);
  if (!src) throw new HttpError(404, "GIFs aren't on here");
  const gifs = await searchGifs(src, new URL(req.url).searchParams.get("q") ?? "");
  return NextResponse.json({ gifs }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } });
});
