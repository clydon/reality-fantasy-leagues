import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { searchSeasonListings } from "@/lib/server/desk-schedule";
import { listingsFor } from "@/lib/server/listings";

// Setup's Find it in the TV listings (docs/PLAN-desk-parity.md step 3, part 3b): TVmaze's search for `?q=`, as Add a show
// searches it, each show's season with this season's number and what using it would fill; other seasons' and ended
// look-alikes greyed, with why. `unavailable` when TVmaze doesn't answer.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchSeasonListings(id, q, listingsFor(req)));
});
