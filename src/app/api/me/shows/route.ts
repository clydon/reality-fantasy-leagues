import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { addShow } from "@/lib/server/add-show";
import { listingsFor } from "@/lib/server/listings";

// Add a show to your shows (docs/PLAN-new-design.md step 10 part 1; add-show.ts): body { listing: <TVmaze id> } or
// { name }, with { seenThrough } for where you are (capped at what's aired) and { live } for Live (keep-up.ts). Finds the
// show (or makes it, "Not a game yet", from its listing or its name) and follows its season openly. Answers the season it
// follows. A season already here is followed with PUT /api/me/follows/[seasonId].
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { listing?: unknown; name?: unknown; seenThrough?: unknown; live?: unknown };
  return NextResponse.json(await addShow(user.id, body, listingsFor(req)));
});
