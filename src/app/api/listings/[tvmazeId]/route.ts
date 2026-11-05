import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { listingSeason, listingsFor, ListingsUnavailable } from "@/lib/server/listings";

// One show from the TV listings and the season adding it would follow, with how many of its episodes have aired
// (docs/PLAN-new-design.md step 10 part 1): where you are, asked before it's added (first run, Add a show), with every season
// it has for the picker; `?season=N` answers that season instead (the user, 2026-11-05: an earlier Below Deck). Open signed out
// and the same for everyone, so the edge keeps it for an hour (each season asked for on its own); nothing from the database.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ tvmazeId: string }> }) => {
  const { tvmazeId } = await params;
  const id = Number(tvmazeId);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, "Not in the TV listings");
  const asked = new URL(req.url).searchParams.get("season");
  const number = asked == null ? null : Number(asked);
  if (number != null && (!Number.isInteger(number) || number < 0)) throw new HttpError(400, "Which season? (its number)");
  try {
    const found = await listingSeason(id, listingsFor(req), new Date(), number);
    if (!found) throw new HttpError(404, number != null ? "That season isn't in the TV listings" : "Not in the TV listings");
    return NextResponse.json(found, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    if (e instanceof ListingsUnavailable) throw new HttpError(503, "TV listings aren't answering. Try again in a minute.");
    throw e;
  }
});
