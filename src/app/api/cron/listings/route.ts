import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireCron } from "@/lib/server/cron";
import { listingsFor } from "@/lib/server/listings";
import { listingsDue, listingsStatus, refreshListings } from "@/lib/server/tv-listings";

// The daily listings job by hand (docs/PLAN-new-design.md step 11 part 2; src/lib/server/tv-listings.ts). It usually runs
// on the bot clock's calls (/api/cron/bot-research); this is for checks, a run by hand, and a backstop should the VM stop
// calling (a Vercel cron on GET ?run=1, docs/HOSTING.md: not set up).
//
//   GET            the last run and how many listings each day has; nothing runs
//   GET ?run=1     run it if today's run is still to do (what a daily cron would call); { ran, run }
//   POST           run it now, whatever's been run today (not while one is running: 409)
//
// Authorization: Bearer <CRON_SECRET>.
export const maxDuration = 300;

export const GET = apiRoute(async (req) => {
  requireCron(req);
  if (new URL(req.url).searchParams.get("run") === "1") {
    const run = (await listingsDue()) ? await refreshListings(listingsFor(req), { how: "cron" }) : null;
    return NextResponse.json({ ran: !!run, run, ...(await listingsStatus()) });
  }
  return NextResponse.json(await listingsStatus());
});

export const POST = apiRoute(async (req) => {
  requireCron(req);
  const run = await refreshListings(listingsFor(req), { force: true, how: "hand" });
  if (!run) throw new HttpError(409, "The listings are being read right now");
  return NextResponse.json({ run, ...(await listingsStatus()) });
});
