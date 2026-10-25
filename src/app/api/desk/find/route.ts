import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { find, requireDesk } from "@/lib/server/desk";

// The desk's Find (step 6b part 2): one search over shows, seasons, castaways, couches, people, rulebooks and facts.
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  return NextResponse.json({ found: await find(new URL(req.url).searchParams.get("q") ?? "") });
});
